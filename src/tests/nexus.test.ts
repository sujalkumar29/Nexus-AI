import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, verifyPersistence } from '../db/prisma.js';
import { searchKnowledgeBase } from '../rag/retriever.js';
import { chunkText, generateLocalEmbedding } from '../rag/ingestion.js';
import { parseOKFContent } from '../rag/okf.js';
import { mcpClient } from '../mcp/client.js';
import { executeSearchKnowledge } from '../mcp/tools/searchKnowledge.js';
import { executeExtractImportantTopics } from '../mcp/tools/extractTopics.js';
import { executeCreateRevisionPlan } from '../mcp/tools/createRevisionPlan.js';
import { executeScheduleStudySessions, detectSessionOverlap } from '../mcp/tools/scheduleSessions.js';
import { executeGenerateQuiz, QuizQuestionSchema } from '../mcp/tools/generateQuiz.js';
import { executeGetWorkflowStatus } from '../mcp/tools/getWorkflowStatus.js';
import { runAutonomousExamWorkflow, extractExamInfo } from '../agent/orchestrator.js';
import { seedDatabase } from '../db/seed.js';

describe('Nexus AI Comprehensive Test Suite', () => {
  before(async () => {
    // Seed database before running tests
    await seedDatabase();
  });

  // 1. MCP server startup & client discovery
  test('1. MCP server startup & tool discovery: lists all 6 registered tools', async () => {
    const tools = await mcpClient.discoverTools();
    assert.ok(Array.isArray(tools), 'Tools should be an array');
    assert.strictEqual(tools.length, 6, 'Should expose exactly 6 registered MCP tools');

    const names = tools.map(t => t.name);
    assert.ok(names.includes('search_knowledge'));
    assert.ok(names.includes('extract_important_topics'));
    assert.ok(names.includes('create_revision_plan'));
    assert.ok(names.includes('schedule_study_sessions'));
    assert.ok(names.includes('generate_quiz'));
    assert.ok(names.includes('get_workflow_status'));
  });

  // 2. Successful knowledge search
  test('2. Successful knowledge search: returns grounded passages for consensus query', async () => {
    const res = await executeSearchKnowledge({
      query: 'Raft consensus leader election safety',
      limit: 3,
    });

    assert.ok(res.total_matches > 0, 'Should find matching passages for Raft');
    assert.ok(res.passages.length > 0, 'Should return passages list');
    assert.ok(res.passages[0].content.toLowerCase().includes('raft') || res.passages[0].content.toLowerCase().includes('election'), 'Content should match query concepts');
    assert.ok(res.passages[0].similarity_score > 0, 'Similarity score should be positive');
  });

  // 3. Retrieval with no matching content
  test('3. Retrieval with no matching content: returns empty result without fabricating sources', async () => {
    const res = await executeSearchKnowledge({
      query: 'Quantum entanglement string theory astrophysics xyz999',
      threshold: 0.85,
    });

    assert.strictEqual(res.total_matches, 0, 'Should not match irrelevant concepts above high threshold');
    assert.strictEqual(res.passages.length, 0, 'Passages list should be empty');
  });

  // 4. Invalid tool arguments error handling
  test('4. Invalid tool arguments: rejects empty search query and invalid exam dates gracefully', async () => {
    await assert.rejects(
      async () => {
        await executeSearchKnowledge({ query: '   ' });
      },
      /Search query must be a non-empty string/,
      'Should reject empty search queries'
    );

    await assert.rejects(
      async () => {
        await executeCreateRevisionPlan({
          topics: [],
          exam_date: 'invalid-not-a-date',
        });
      },
      /At least one topic is required/,
      'Should reject plan creation with empty topics'
    );
  });

  // 5. Topic extraction from retrieved notes
  test('5. Topic extraction: extracts high-yield topics with grounded source references', async () => {
    const res = await executeExtractImportantTopics({
      course_context: 'CS452 Distributed Systems',
    });

    assert.ok(res.total_topics >= 3, 'Should extract at least 3 major topics');
    assert.ok(res.topics.some(t => t.name.includes('Consensus')), 'Should include Consensus topic');
    assert.ok(res.topics.some(t => t.name.includes('Vector Clock')), 'Should include Vector Clocks topic');
    assert.ok(res.topics.some(t => t.name.includes('Byzantine')), 'Should include Byzantine fault tolerance topic');

    // Verify source references exist
    for (const topic of res.topics) {
      assert.ok(topic.source_reference.file_name, 'Every topic must have a supporting file reference');
      assert.ok(topic.priority_estimate, 'Every topic must have an explicit priority estimate');
    }
  });

  // 6. Revision plan creation
  test('6. Revision plan creation: allocates study milestones up to exam date', async () => {
    const res = await executeCreateRevisionPlan({
      topics: [
        { name: 'Distributed Consensus & Raft', priority: 'CRITICAL' },
        { name: 'Vector Clocks', priority: 'HIGH' },
      ],
      exam_date: 'Friday',
      available_hours: 8.5,
    });

    assert.strictEqual(res.plan_status, 'DRAFT_PROPOSAL', 'Should mark initial plan as draft proposal');
    assert.ok(res.milestones.length >= 3, 'Should generate at least 3 milestones');
    assert.strictEqual(res.total_target_hours, 8.5, 'Should respect user requested study hours');
    assert.ok(res.days_remaining >= 1, 'Days remaining should be calculated');
  });

  // 7. Scheduling conflict detection
  test('7. Scheduling conflict detection: identifies overlapping time slots', async () => {
    const existingSessions = await prisma.studySession.findMany({ take: 1 });
    assert.ok(existingSessions.length > 0, 'Should have at least 1 existing session from seed');

    const existing = existingSessions[0];
    const overlapCheck = await detectSessionOverlap(
      new Date(existing.startTime.getTime() + 10 * 60 * 1000), // 10 minutes after start
      new Date(existing.endTime.getTime() - 10 * 60 * 1000)    // 10 minutes before end
    );

    assert.strictEqual(overlapCheck.hasOverlap, true, 'Should detect overlap inside existing session');
    assert.ok(overlapCheck.conflictingSession, 'Should return conflicting session details');
  });

  // 8. Database persistence & read-back verification
  test('8. Database persistence: verifies writes by reading back from storage', async () => {
    const testSession = await prisma.studySession.create({
      data: {
        title: 'Unit Test Persistence Session',
        focusTopic: 'Testing Verification Protocol',
        startTime: new Date('2026-11-01T10:00:00Z'),
        endTime: new Date('2026-11-01T12:00:00Z'),
        durationMinutes: 120,
        location: 'Virtual Test Pod',
        priority: 'MEDIUM',
        status: 'CONFIRMED',
        verified: true,
      },
    });

    const isVerified = await verifyPersistence('session', testSession.id);
    assert.strictEqual(isVerified, true, 'verifyPersistence must confirm record exists in SQLite');

    // Clean up test session
    await prisma.studySession.delete({ where: { id: testSession.id } });
  });

  // 9. Quiz question schema validation & scoring
  test('9. Quiz question schema validation: validates required fields, choices, and rationale', async () => {
    const validQuestion = {
      questionNumber: 1,
      prompt: 'What invariant guarantees Raft election safety in a cluster?',
      options: [
        { label: 'A', text: 'Option A text here' },
        { label: 'B', text: 'Option B text here' },
        { label: 'C', text: 'Option C text here' },
        { label: 'D', text: 'Option D text here' },
      ],
      correctAnswer: 'B',
      rationale: 'Quorums intersect in at least one server node.',
      citation: 'CS452_Lec4.md',
    };

    const validParse = QuizQuestionSchema.safeParse(validQuestion);
    assert.strictEqual(validParse.success, true, 'Valid question should pass Zod schema validation');

    // Malformed question (missing options)
    const malformedQuestion = {
      questionNumber: 2,
      prompt: 'Too short',
      options: [{ label: 'A', text: 'Only one option' }],
      correctAnswer: 'E', // Invalid answer letter
    };
    const invalidParse = QuizQuestionSchema.safeParse(malformedQuestion);
    assert.strictEqual(invalidParse.success, false, 'Malformed question must be rejected by schema');
  });

  // 10. Workflow status retrieval
  test('10. Workflow status retrieval: returns real DB workflow record and timeline', async () => {
    const res = await executeGetWorkflowStatus({
      workflow_id: 'RUN-8821B',
    });

    assert.strictEqual(res.run_id, 'RUN-8821B');
    assert.strictEqual(res.status, 'COMPLETED');
    assert.ok(res.total_steps >= 6, 'Should report 6 completed workflow steps');
    assert.ok(res.timeline.length >= 6, 'Timeline should contain 6 steps');
    assert.ok(res.persisted_entities.session_ids.length > 0, 'Should include saved session references');
    assert.strictEqual(res.persisted_entities.quiz_code, 'QZ-409');
  });

  // 11. Partial workflow failure & missing input handling
  test('11. Missing inputs handling: prompts user when exam date is missing', async () => {
    const info = extractExamInfo('Find important topics in my notes and generate a quiz.');
    assert.strictEqual(info.examDate, null, 'Should detect missing exam date');
    assert.ok(info.missingInfo?.includes('Please provide your exam date'), 'Should ask user for clarification');

    const result = await runAutonomousExamWorkflow('Find important topics in my notes.');
    assert.strictEqual(result.status, 'NEEDS_INPUT', 'Workflow should halt and request clarification');
    assert.ok(result.summary.includes('exam date'), 'Summary should guide user to supply missing date');
  });

  // 12. OKF curated knowledge format parsing & validation
  test('12. OKF curated knowledge validation: parses YAML frontmatter and verifies required metadata', () => {
    const sampleOKF = `---
id: "okf-sample-test"
title: "Distributed Fault Models"
description: "Analysis of crash vs Byzantine faults"
version: "1.0.0"
tags: ["distributed-systems", "fault-tolerance"]
license: "MIT"
---

# Content Body`;

    const parsed = parseOKFContent(sampleOKF);
    assert.strictEqual(parsed.isValid, true, 'Valid OKF markdown should pass validation');
    assert.strictEqual(parsed.metadata.title, 'Distributed Fault Models');
    assert.strictEqual(parsed.metadata.version, '1.0.0');

    // Missing license and tags
    const invalidOKF = `---
title: "Missing fields"
---
# Body`;
    const badParsed = parseOKFContent(invalidOKF);
    assert.strictEqual(badParsed.isValid, false, 'Incomplete OKF frontmatter must be flagged');
    assert.ok(badParsed.errors.length > 0, 'Should return error list for missing required fields');
  });

  // 13. The complete end-to-end exam preparation workflow
  test('13. Complete exam preparation workflow: executes 6 MCP tools, checks conflicts, and verifies persistence', async () => {
    const userPrompt = 'I have an exam on Friday. Find important topics in my notes, create a revision plan, schedule study sessions, and generate a quiz.';
    
    const outcome = await runAutonomousExamWorkflow(userPrompt);

    assert.strictEqual(outcome.status, 'COMPLETED', 'Workflow must complete with COMPLETED status');
    assert.ok(outcome.runId.startsWith('RUN-'), 'Should generate unique RUN ID');
    assert.ok(outcome.toolSteps.length >= 6, 'Must execute all tool steps');
    
    // Check results
    assert.ok(outcome.results.topicsCount >= 3, 'Must extract at least 3 topics');
    assert.ok(outcome.results.milestones.length >= 3, 'Must generate revision milestones');
    assert.ok(outcome.results.scheduledSessionsCount >= 3, 'Must schedule study sessions');
    assert.ok(outcome.results.quizCode, 'Must generate quiz code');
    assert.ok(outcome.results.quizQuestionsCount >= 5, 'Must generate at least 5 questions');

    // Check verified database persistence
    assert.strictEqual(outcome.verificationAudit.workflowPersisted, true, 'Workflow must be verified in DB');
    assert.strictEqual(outcome.verificationAudit.planPersisted, true, 'Plan must be verified in DB');
    assert.strictEqual(outcome.verificationAudit.sessionsPersisted, true, 'Sessions must be verified in DB');
    assert.strictEqual(outcome.verificationAudit.quizPersisted, true, 'Quiz must be verified in DB');
    assert.strictEqual(outcome.verificationAudit.allVerified, true, 'All persisted entities must be verified');
  });
});
