import path from 'node:path';
import fs from 'node:fs/promises';
import { prisma } from './prisma.js';
import { ingestFile } from '../rag/ingestion.js';
import { ingestOKFFile } from '../rag/okf.js';

export async function seedDatabase() {
  console.log('Seeding Nexus AI database...');

  // Clean existing records if any
  await prisma.quizAnswer.deleteMany();
  await prisma.quizAttempt.deleteMany();
  await prisma.quizQuestion.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.studySession.deleteMany();
  await prisma.revisionPlan.deleteMany();
  await prisma.workflowStep.deleteMany();
  await prisma.workflow.deleteMany();
  await prisma.documentChunk.deleteMany();
  await prisma.knowledgeSource.deleteMany();

  // 1. Ingest Sample Notes
  const sampleNotesDir = path.resolve(process.cwd(), 'data', 'sample_notes');
  try {
    const files = await fs.readdir(sampleNotesDir);
    for (const file of files) {
      if (file.endsWith('.md') || file.endsWith('.txt')) {
        const fullPath = path.join(sampleNotesDir, file);
        const result = await ingestFile(fullPath, { category: 'user' });
        console.log(`Indexed user note: ${result.title} (${result.chunksCount} passages)`);
      }
    }
  } catch (err) {
    console.warn('Could not read sample_notes dir:', err);
  }

  // 2. Ingest Curated OKF Collections
  const okfDir = path.resolve(process.cwd(), 'data', 'curated_okf');
  try {
    const files = await fs.readdir(okfDir);
    for (const file of files) {
      if (file.endsWith('.md')) {
        const fullPath = path.join(okfDir, file);
        const result = await ingestOKFFile(fullPath);
        if (result) {
          console.log(`Indexed OKF curated note: ${result.title} (${result.chunksCount} passages)`);
        }
      }
    }
  } catch (err) {
    console.warn('Could not read curated_okf dir:', err);
  }

  // 3. Create Sample Baseline Completed Workflow (#RUN-8821B) from Stitch Design
  const now = new Date();
  const examDate = new Date();
  examDate.setDate(now.getDate() + ((5 - now.getDay() + 7) % 7 || 7)); // Next Friday
  examDate.setHours(9, 0, 0, 0);

  const workflow = await prisma.workflow.create({
    data: {
      runId: 'RUN-8821B',
      title: 'Exam Preparation Autonomous Pipeline: CS452 Distributed Systems',
      goal: 'I have an exam on Friday. Find important topics in my notes, create a revision plan, schedule study sessions, and generate a quiz.',
      status: 'COMPLETED',
      examDate,
      targetHours: 8.5,
      latencyMs: 1280,
      steps: {
        create: [
          {
            stepIndex: 1,
            toolName: 'understanding_intent',
            status: 'COMPLETED',
            inputPayload: JSON.stringify({
              user_request: 'I have an exam on Friday. Find important topics in my notes, create a revision plan, schedule study sessions, and generate a quiz.',
              identified_target_date: examDate.toISOString(),
            }),
            outputPayload: JSON.stringify({
              intent: 'exam_preparation',
              target_course: 'CS452 Distributed Systems',
              subtasks: ['search_notes', 'extract_topics', 'create_schedule', 'book_calendar', 'generate_quiz'],
            }),
            latencyMs: 182,
            verified: true,
          },
          {
            stepIndex: 2,
            toolName: 'search_knowledge',
            status: 'COMPLETED',
            inputPayload: JSON.stringify({
              query: 'CS452 distributed systems midterm exam notes consensus vector clocks byzantine',
              limit: 4,
              threshold: 0.4,
            }),
            outputPayload: JSON.stringify({
              total_matches: 4,
              passages_found: 14,
              top_sources: ['CS452_Lec4_Raft_Consensus.md', 'CS452_Lec6_Vector_Clocks_Ordering.md', 'CS452_Lec7_Byzantine_Fault_Tolerance.md'],
            }),
            latencyMs: 342,
            verified: true,
          },
          {
            stepIndex: 3,
            toolName: 'extract_important_topics',
            status: 'COMPLETED',
            inputPayload: JSON.stringify({
              course: 'CS452 Distributed Systems',
              exam_date: examDate.toISOString(),
            }),
            outputPayload: JSON.stringify({
              topics: [
                { id: 'topic-1', name: 'Distributed Consensus & Raft Protocol', priority: 'CRITICAL', match: '98%', source: 'CS452_Lec4_Raft_Consensus.md' },
                { id: 'topic-2', name: 'Vector Clock Causality & Partial Ordering', priority: 'HIGH', match: '94%', source: 'CS452_Lec6_Vector_Clocks_Ordering.md' },
                { id: 'topic-3', name: 'Byzantine Fault Tolerance & State Machine Safety', priority: 'HIGH', match: '89%', source: 'CS452_Lec7_Byzantine_Fault_Tolerance.md' },
              ],
            }),
            latencyMs: 210,
            verified: true,
          },
          {
            stepIndex: 4,
            toolName: 'create_revision_plan',
            status: 'COMPLETED',
            inputPayload: JSON.stringify({
              topics_count: 3,
              exam_date: examDate.toISOString(),
              target_hours: 8.5,
            }),
            outputPayload: JSON.stringify({
              plan_id: 'plan-cs452-midterm',
              milestones: [
                { day: 'Wednesday', title: 'Core Consensus Architecture (Raft)', hours: 2.5 },
                { day: 'Thursday', title: 'Clocks & Synchronization (Vector Clocks)', hours: 3.0 },
                { day: 'Friday Morning', title: 'Active Recall Sprint (PBFT & Edge Cases)', hours: 3.0 },
              ],
            }),
            latencyMs: 195,
            verified: true,
          },
          {
            stepIndex: 5,
            toolName: 'schedule_study_sessions',
            status: 'COMPLETED',
            inputPayload: JSON.stringify({
              plan_id: 'plan-cs452-midterm',
              sessions_count: 3,
            }),
            outputPayload: JSON.stringify({
              scheduled: 3,
              conflicts: 0,
              db_status: 'PERSISTED_AND_VERIFIED',
              session_ids: ['sess-1', 'sess-2', 'sess-3'],
            }),
            latencyMs: 178,
            verified: true,
          },
          {
            stepIndex: 6,
            toolName: 'generate_quiz',
            status: 'COMPLETED',
            inputPayload: JSON.stringify({
              topics: ['Raft Consensus', 'Vector Clocks', 'Byzantine Faults'],
              question_count: 5,
              difficulty: 'hard',
            }),
            outputPayload: JSON.stringify({
              quiz_id: 'QZ-409',
              questions_generated: 5,
              schema_valid: true,
              persisted: true,
            }),
            latencyMs: 173,
            verified: true,
          },
        ],
      },
      revisionPlan: {
        create: {
          title: 'CS452 Distributed Systems Midterm Revision Plan',
          examDate,
          targetHours: 8.5,
          status: 'PERSISTED',
          topics: JSON.stringify([
            { id: 't1', title: 'Distributed Consensus & Raft', weight: 'CRITICAL', match: '98%', source: 'CS452_Lec4_Raft_Consensus.md' },
            { id: 't2', title: 'Vector Clock Causality', weight: 'HIGH', match: '94%', source: 'CS452_Lec6_Vector_Clocks_Ordering.md' },
            { id: 't3', title: 'Byzantine Fault Tolerance', weight: 'HIGH', match: '89%', source: 'CS452_Lec7_Byzantine_Fault_Tolerance.md' },
          ]),
          milestones: JSON.stringify([
            { day: 'Wednesday', title: 'Core Consensus Architecture', duration: '2.5 hrs', desc: 'Master Leader Election, Log Replication invariants, and Joint Consensus reconfiguration safety guarantees.' },
            { day: 'Thursday', title: 'Clocks & Synchronization', duration: '3.0 hrs', desc: 'Lamport Timestamps, Partial vs Total Ordering, Vector timestamp comparisons, and causal delivery protocols.' },
            { day: 'Friday Morning', title: 'Active Recall Sprint', duration: '3.0 hrs', desc: 'Timed practice test, BFT edge cases review (f < n/3), state machine simulation run.' },
          ]),
        },
      },
    },
  });

  // 4. Create Saved Study Sessions
  const wedDate = new Date(now);
  wedDate.setDate(now.getDate() + ((3 - now.getDay() + 7) % 7 || 7));
  wedDate.setHours(16, 0, 0, 0);

  const thuDate = new Date(now);
  thuDate.setDate(now.getDate() + ((4 - now.getDay() + 7) % 7 || 7));
  thuDate.setHours(14, 0, 0, 0);

  const friDate = new Date(examDate);
  friDate.setHours(7, 30, 0, 0);

  await prisma.studySession.createMany({
    data: [
      {
        workflowId: workflow.id,
        title: 'Raft Consensus Deep Dive',
        focusTopic: 'Distributed Consensus & Raft Protocol',
        startTime: wedDate,
        endTime: new Date(wedDate.getTime() + 2 * 60 * 60 * 1000),
        durationMinutes: 120,
        location: 'Quiet Study 3B',
        priority: 'CRITICAL',
        status: 'CONFIRMED',
        verified: true,
      },
      {
        workflowId: workflow.id,
        title: 'Vector Clocks & Matrix Clocks',
        focusTopic: 'Vector Clock Causality & Partial Ordering',
        startTime: thuDate,
        endTime: new Date(thuDate.getTime() + 2 * 60 * 60 * 1000),
        durationMinutes: 120,
        location: 'Desk 12 + Nexus Pod',
        priority: 'HIGH',
        status: 'CONFIRMED',
        verified: true,
      },
      {
        workflowId: workflow.id,
        title: 'BFT & State Machine Safety Review',
        focusTopic: 'Byzantine Fault Tolerance & Replicated State Machines',
        startTime: friDate,
        endTime: new Date(friDate.getTime() + 90 * 60 * 1000),
        durationMinutes: 90,
        location: 'Study Hub Alpha',
        priority: 'HIGH',
        status: 'CONFIRMED',
        verified: true,
      },
    ],
  });

  // 5. Create Generated Practice Quiz (ID: QZ-409)
  await prisma.quiz.create({
    data: {
      quizCode: 'QZ-409',
      workflowId: workflow.id,
      title: 'CS452 Distributed Systems Midterm Diagnostic Quiz',
      course: 'CS452 Distributed Systems',
      topic: 'Consensus, Vector Clocks, and BFT',
      difficulty: 'hard',
      totalQuestions: 5,
      status: 'SAVED',
      questions: {
        create: [
          {
            questionNumber: 1,
            prompt: 'In a Raft consensus cluster with 5 nodes, Node S1 is a Candidate for Term 3. If nodes S2 and S3 grant votes to S1, but S4 and S5 time out simultaneously and initiate split elections for Term 3, what formal protocol invariant guarantees that two distinct leaders cannot be simultaneously elected for Term 3?',
            options: JSON.stringify([
              { label: 'A', text: 'State Machine Safety: ensures no two servers execute contradictory commands at the same index, causing rollback.' },
              { label: 'B', text: 'Election Safety: each node votes at most once per term, and a candidate requires a strict majority (at least 3 of 5 nodes), making overlapping majorities mathematically impossible.' },
              { label: 'C', text: 'Leader Append-Only: forces candidate terms to synchronize monotonically via an external coordinator heartbeat.' },
              { label: 'D', text: 'Log Matching Invariant: prevents conflicting candidates from advancing terms until at least 4 nodes acknowledge the candidate RPC.' },
            ]),
            correctAnswer: 'B',
            rationale: 'Under Raft\'s Election Safety invariant (Invar 5.2), each server votes for at most one candidate in a given term on a first-come-first-served basis. Because any majority of 5 nodes must contain at least 3 nodes, any two majorities must intersect in at least one server (3 + 3 = 6 > 5). Therefore, two candidates cannot both receive votes from majorities in Term 3.',
            citation: 'CS452_Lec4_Raft_Consensus.md § 1. Election Safety',
            similarityScore: 0.942,
          },
          {
            questionNumber: 2,
            prompt: 'In an asynchronous distributed system of N nodes subject to Byzantine (arbitrary) failures, what is the maximum number of Byzantine faulty nodes f that the system can tolerate while maintaining safety and liveness?',
            options: JSON.stringify([
              { label: 'A', text: 'f < N / 2 (Crash fault tolerance majority)' },
              { label: 'B', text: 'f < N / 3 (Strictly N >= 3f + 1)' },
              { label: 'C', text: 'f < 2N / 3' },
              { label: 'D', text: 'f <= sqrt(N)' },
            ]),
            correctAnswer: 'B',
            rationale: 'In asynchronous networks with Byzantine nodes, an unresponsive node cannot be distinguished from a slow node, requiring quorums of size N - f. Within that quorum, up to f nodes could be Byzantine liars. To guarantee that honest nodes outnumber Byzantine nodes in every quorum, (N - f) - f > f, which simplifies to N >= 3f + 1 or f < N / 3.',
            citation: 'CS452_Lec7_Byzantine_Fault_Tolerance.md § 2. Theoretical Lower Bound',
            similarityScore: 0.925,
          },
          {
            questionNumber: 3,
            prompt: 'Suppose events a and b have vector timestamps V(a) = [2, 1, 3] and V(b) = [1, 2, 4]. What is the causal relationship between events a and b?',
            options: JSON.stringify([
              { label: 'A', text: 'Event a happened before event b (a -> b)' },
              { label: 'B', text: 'Event b happened before event a (b -> a)' },
              { label: 'C', text: 'Events a and b are concurrent (a || b)' },
              { label: 'D', text: 'They are in the same logical process' },
            ]),
            correctAnswer: 'C',
            rationale: 'Under the Vector Clock comparison theorem, V(a) < V(b) iff every component V(a)[k] <= V(b)[k] and at least one is strictly less. Here, V(a)[0] = 2 > V(b)[0] = 1, but V(a)[1] = 1 < V(b)[1] = 2. Neither dominates, therefore a and b are concurrent (a || b).',
            citation: 'CS452_Lec6_Vector_Clocks_Ordering.md § 3. Strong Causal Equivalence',
            similarityScore: 0.918,
          },
          {
            questionNumber: 4,
            prompt: 'Why does Raft use randomized election timers (e.g. 150ms – 300ms) for followers rather than a fixed timeout across all nodes?',
            options: JSON.stringify([
              { label: 'A', text: 'To encrypt RPC communication over insecure networks.' },
              { label: 'B', text: 'To prevent split votes where candidates simultaneously request votes and partition the cluster vote evenly.' },
              { label: 'C', text: 'To compensate for physical clock drift in crystal oscillators.' },
              { label: 'D', text: 'To avoid running leader election when network latency is zero.' },
            ]),
            correctAnswer: 'B',
            rationale: 'Randomized election timeouts spread out election triggers so that in most cases only a single follower times out, becomes candidate, and collects majorities before any other node times out.',
            citation: 'CS452_Lec4_Raft_Consensus.md § 2. Leader Election Mechanism',
            similarityScore: 0.887,
          },
          {
            questionNumber: 5,
            prompt: 'What is the purpose of the Pre-Prepare phase in the Practical Byzantine Fault Tolerance (PBFT) protocol?',
            options: JSON.stringify([
              { label: 'A', text: 'The backup nodes elect a new primary node using Paxos.' },
              { label: 'B', text: 'The primary node assigns a monotonic sequence number to the request and broadcasts it to backup nodes.' },
              { label: 'C', text: 'The client directly writes to disk on all replica nodes.' },
              { label: 'D', text: 'Nodes discard all previous uncommitted log entries.' },
            ]),
            correctAnswer: 'B',
            rationale: 'In PBFT, the Pre-Prepare phase establishes a definitive ordering for requests within a view by assigning a monotonic sequence number n and digest d to client request m.',
            citation: 'CS452_Lec7_Byzantine_Fault_Tolerance.md § 3. PBFT',
            similarityScore: 0.895,
          },
        ],
      },
    },
  });

  console.log('Database seeded successfully! Workflow #RUN-8821B created with 6 verified steps, revision plan, 3 study sessions, and Quiz QZ-409.');
}

// Run if called directly
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
