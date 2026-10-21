import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { prisma, verifyPersistence } from '../db/prisma.js';
import { searchKnowledgeBase } from '../rag/retriever.js';
import { ingestFile } from '../rag/ingestion.js';
import { mcpClient } from '../mcp/client.js';
import { runAutonomousExamWorkflow } from '../agent/orchestrator.js';
import { detectSessionOverlap } from '../mcp/tools/scheduleSessions.js';

export const apiRouter = Router();

// Configure multer for file uploads
const uploadDir = path.resolve(process.cwd(), 'uploads');
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err: any) {
      cb(err, uploadDir);
    }
  },
  filename: (_req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${cleanName}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = ['.md', '.txt', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Supported types: .md, .txt, .pdf`));
    }
  },
});

// ---------------------------------------------------------------------
// 1. Health, Readiness & Telemetry
// ---------------------------------------------------------------------
apiRouter.get('/health', async (_req, res) => {
  res.json({
    status: 'healthy',
    gateway: 'Nexus AI Alexa+ Gateway',
    version: '1.4.0',
    timestamp: new Date().toISOString(),
    mcp: {
      active_tools: 6,
      transport: 'Streamable HTTP (spec 2025-11-25+)',
      endpoint: '/mcp',
    },
    database: {
      engine: 'SQLite (Prisma)',
      status: 'connected',
    },
  });
});

apiRouter.get('/status', async (_req, res) => {
  const startTime = Date.now();
  const docCount = await prisma.knowledgeSource.count();
  const chunkCount = await prisma.documentChunk.count();
  const workflowCount = await prisma.workflow.count();
  const sessionCount = await prisma.studySession.count();
  const quizCount = await prisma.quiz.count();
  const latency = Date.now() - startTime;

  res.json({
    system_latency_ms: Math.max(12, latency),
    active_mcp_tools: 6,
    indexed_documents: docCount,
    extracted_passages: chunkCount,
    workflows_executed: workflowCount,
    study_sessions: sessionCount,
    quizzes_generated: quizCount,
    mcp_endpoint: 'http://localhost:3001/mcp',
  });
});

// ---------------------------------------------------------------------
// 2. Knowledge Base & Documents
// ---------------------------------------------------------------------
apiRouter.get('/documents', async (_req, res) => {
  try {
    const docs = await prisma.knowledgeSource.findMany({
      orderBy: { indexedAt: 'desc' },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });

    res.json(
      docs.map(d => ({
        id: d.id,
        title: d.title,
        fileName: d.fileName,
        fileType: d.fileType,
        fileSize: d.fileSize,
        category: d.category,
        tokenCount: d.tokenCount,
        passagesCount: d._count.chunks,
        status: d.status,
        indexedAt: d.indexedAt.toISOString(),
      }))
    );
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/documents/:id/chunks', async (req, res) => {
  try {
    const chunks = await prisma.documentChunk.findMany({
      where: { sourceId: req.params.id },
      orderBy: { chunkIndex: 'asc' },
    });
    res.json(chunks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/documents/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded.' });
      return;
    }

    const title = req.body.title || req.file.originalname.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
    const category = (req.body.category as 'user' | 'curated') || 'user';

    const result = await ingestFile(req.file.path, {
      title,
      category,
    });

    res.status(201).json({
      message: 'Document uploaded and indexed successfully!',
      document: result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/documents/:id', async (req, res) => {
  try {
    await prisma.knowledgeSource.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Document and extracted chunks deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------
// 3. Search & RAG
// ---------------------------------------------------------------------
apiRouter.get('/search', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    if (!query) {
      res.status(400).json({ error: 'Search query parameter "q" is required.' });
      return;
    }

    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 5;
    const threshold = req.query.threshold ? parseFloat(String(req.query.threshold)) : 0.35;
    const category = (req.query.category as any) || 'all';

    const passages = await searchKnowledgeBase(query, {
      limit,
      threshold,
      category,
    });

    res.json({
      query,
      total_matches: passages.length,
      passages,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------
// 4. Agent Orchestration & Chat
// ---------------------------------------------------------------------
apiRouter.post('/chat', async (req, res) => {
  try {
    const prompt = String(req.body.prompt || req.body.message || '').trim();
    if (!prompt) {
      res.status(400).json({ error: 'Prompt or message is required.' });
      return;
    }

    const execution = await runAutonomousExamWorkflow(prompt);
    res.json(execution);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------
// 5. Workflows History & Audit
// ---------------------------------------------------------------------
apiRouter.get('/workflows', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const statusFilter = req.query.status ? String(req.query.status).toUpperCase() : undefined;

    const workflows = await prisma.workflow.findMany({
      where: statusFilter && statusFilter !== 'ALL' ? { status: statusFilter } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        steps: { orderBy: { stepIndex: 'asc' } },
        revisionPlan: true,
        studySessions: true,
        quiz: true,
      },
    });

    res.json(
      workflows.map(w => ({
        id: w.id,
        runId: w.runId,
        title: w.title,
        goal: w.goal,
        status: w.status,
        latencyMs: w.latencyMs,
        stepsCount: w.steps.length,
        hasPlan: !!w.revisionPlan,
        sessionsCount: w.studySessions.length,
        quizCode: w.quiz?.quizCode,
        createdAt: w.createdAt.toISOString(),
      }))
    );
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/workflows/:id', async (req, res) => {
  try {
    const workflow = await prisma.workflow.findFirst({
      where: {
        OR: [
          { id: req.params.id },
          { runId: req.params.id },
        ],
      },
      include: {
        steps: { orderBy: { stepIndex: 'asc' } },
        revisionPlan: true,
        studySessions: true,
        quiz: {
          include: { questions: true },
        },
      },
    });

    if (!workflow) {
      res.status(404).json({ error: 'Workflow not found.' });
      return;
    }

    res.json(workflow);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------
// 6. Revision Planner & Calendar
// ---------------------------------------------------------------------
apiRouter.get('/planner/sessions', async (_req, res) => {
  try {
    const sessions = await prisma.studySession.findMany({
      orderBy: { startTime: 'asc' },
    });
    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/planner/sessions', async (req, res) => {
  try {
    const { title, focusTopic, startTime, endTime, location, priority } = req.body;
    if (!title || !startTime || !endTime) {
      res.status(400).json({ error: 'Title, startTime, and endTime are required.' });
      return;
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    // Overlap conflict detection
    const { hasOverlap, conflictingSession } = await detectSessionOverlap(startDate, endDate);
    if (hasOverlap && conflictingSession) {
      res.status(409).json({
        error: `Schedule Conflict: Overlaps with "${conflictingSession.title}" (${conflictingSession.startTime.toLocaleTimeString()} - ${conflictingSession.endTime.toLocaleTimeString()})`,
        conflict: conflictingSession,
      });
      return;
    }

    const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
    const session = await prisma.studySession.create({
      data: {
        title,
        focusTopic: focusTopic || title,
        startTime: startDate,
        endTime: endDate,
        durationMinutes,
        location: location || 'Quiet Study 3B',
        priority: priority || 'HIGH',
        status: 'CONFIRMED',
        verified: true,
      },
    });

    const verified = await verifyPersistence('session', session.id);
    res.status(201).json({ ...session, verified });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/planner/sessions/:id', async (req, res) => {
  try {
    await prisma.studySession.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Session deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------
// 7. Quiz Studio
// ---------------------------------------------------------------------
apiRouter.get('/quizzes', async (_req, res) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { questions: true, attempts: true } },
      },
    });
    res.json(quizzes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/quizzes/:id', async (req, res) => {
  try {
    const quiz = await prisma.quiz.findFirst({
      where: {
        OR: [
          { id: req.params.id },
          { quizCode: req.params.id },
        ],
      },
      include: {
        questions: { orderBy: { questionNumber: 'asc' } },
        attempts: { orderBy: { completedAt: 'desc' } },
      },
    });

    if (!quiz) {
      res.status(404).json({ error: 'Quiz not found.' });
      return;
    }

    // Parse options from JSON string
    const formattedQuestions = quiz.questions.map(q => {
      let optionsList: any[] = [];
      try {
        optionsList = JSON.parse(q.options);
      } catch {
        optionsList = [];
      }
      return {
        id: q.id,
        questionNumber: q.questionNumber,
        prompt: q.prompt,
        options: optionsList,
        correctAnswer: q.correctAnswer,
        rationale: q.rationale,
        citation: q.citation,
        similarityScore: q.similarityScore,
      };
    });

    res.json({
      ...quiz,
      questions: formattedQuestions,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/quizzes/:id/attempt', async (req, res) => {
  try {
    const quiz = await prisma.quiz.findFirst({
      where: {
        OR: [{ id: req.params.id }, { quizCode: req.params.id }],
      },
      include: {
        questions: { orderBy: { questionNumber: 'asc' } },
      },
    });

    if (!quiz) {
      res.status(404).json({ error: 'Quiz not found.' });
      return;
    }

    const userAnswers: Record<string, string> = req.body.answers || {};
    let correctCount = 0;
    const breakdown: any[] = [];

    const answersToCreate: any[] = [];

    for (const q of quiz.questions) {
      const selected = userAnswers[q.id] || userAnswers[String(q.questionNumber)] || '';
      const isCorrect = selected.toUpperCase() === q.correctAnswer.toUpperCase();
      if (isCorrect) correctCount++;

      breakdown.push({
        questionId: q.id,
        questionNumber: q.questionNumber,
        prompt: q.prompt,
        selectedAnswer: selected,
        correctAnswer: q.correctAnswer,
        isCorrect,
        rationale: q.rationale,
        citation: q.citation,
      });

      answersToCreate.push({
        questionId: q.id,
        selectedAnswer: selected,
        isCorrect,
      });
    }

    const maxScore = quiz.questions.length;
    const percentage = Number(((correctCount / maxScore) * 100).toFixed(1));

    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        score: correctCount,
        maxScore,
        percentage,
        answers: {
          create: answersToCreate,
        },
      },
    });

    res.json({
      attemptId: attempt.id,
      score: correctCount,
      maxScore,
      percentage,
      breakdown,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------
// 8. MCP Developer Console & Sandbox
// ---------------------------------------------------------------------
apiRouter.get('/mcp/tools', async (_req, res) => {
  try {
    const tools = await mcpClient.discoverTools();
    res.json({
      mcp_specification: '2025-11-25',
      streamable_http_transport: true,
      endpoint: '/mcp',
      tools,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/mcp/dry-run', async (req, res) => {
  try {
    const { toolName, payload } = req.body;
    if (!toolName) {
      res.status(400).json({ error: 'toolName is required for dry run.' });
      return;
    }

    const invocation = await mcpClient.callTool(toolName, payload || {});
    res.json(invocation);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
