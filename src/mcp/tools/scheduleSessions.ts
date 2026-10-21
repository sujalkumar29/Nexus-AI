import { prisma, verifyPersistence } from '../../db/prisma.js';

export interface ProposedSession {
  id?: string;
  title: string;
  focusTopic: string;
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  location?: string;
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

export interface ScheduleSessionsInput {
  workflow_id?: string;
  plan_id?: string;
  sessions?: ProposedSession[];
  auto_resolve_conflicts?: boolean;
}

export interface SavedSessionResult {
  id: string;
  title: string;
  focusTopic: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  location: string;
  priority: string;
  status: 'CONFIRMED' | 'CONFLICT';
  conflictDetails?: string;
  persisted_and_verified: boolean;
}

export interface ScheduleSessionsOutput {
  status: 'PERSISTED' | 'CONFLICT_DETECTED';
  total_submitted: number;
  total_persisted: number;
  conflicts_detected: number;
  confirmed_sessions: SavedSessionResult[];
  verification_status: string;
  calendar_sync_note: string;
}

/**
 * Check if a time range overlaps with any existing confirmed study session in the database.
 */
export async function detectSessionOverlap(
  start: Date,
  end: Date,
  excludeId?: string
): Promise<{ hasOverlap: boolean; conflictingSession?: any }> {
  const existing = await prisma.studySession.findMany({
    where: {
      status: 'CONFIRMED',
      id: excludeId ? { not: excludeId } : undefined,
      OR: [
        {
          // Existing session starts during new session
          startTime: { gte: start, lt: end },
        },
        {
          // Existing session ends during new session
          endTime: { gt: start, lte: end },
        },
        {
          // Existing session completely encompasses new session
          startTime: { lte: start },
          endTime: { gte: end },
        },
      ],
    },
  });

  if (existing.length > 0) {
    return { hasOverlap: true, conflictingSession: existing[0] };
  }
  return { hasOverlap: false };
}

export async function executeScheduleStudySessions(input: ScheduleSessionsInput): Promise<ScheduleSessionsOutput> {
  const now = new Date();

  // If sessions are not provided directly, construct the standard 3-session revision schedule
  let sessionsToSchedule: ProposedSession[] = input.sessions || [];

  if (sessionsToSchedule.length === 0) {
    const wedDate = new Date(now);
    wedDate.setDate(now.getDate() + ((3 - now.getDay() + 7) % 7 || 7));
    wedDate.setHours(16, 0, 0, 0);

    const thuDate = new Date(now);
    thuDate.setDate(now.getDate() + ((4 - now.getDay() + 7) % 7 || 7));
    thuDate.setHours(14, 0, 0, 0);

    const friDate = new Date(now);
    friDate.setDate(now.getDate() + ((5 - now.getDay() + 7) % 7 || 7));
    friDate.setHours(7, 30, 0, 0);

    sessionsToSchedule = [
      {
        title: 'Raft Consensus Deep Dive',
        focusTopic: 'Distributed Consensus & Raft Protocol',
        startTime: wedDate.toISOString(),
        endTime: new Date(wedDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        location: 'Quiet Study 3B',
        priority: 'CRITICAL',
      },
      {
        title: 'Vector Clocks & Matrix Clocks',
        focusTopic: 'Vector Clock Causality & Partial Ordering',
        startTime: thuDate.toISOString(),
        endTime: new Date(thuDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        location: 'Desk 12 + Nexus Pod',
        priority: 'HIGH',
      },
      {
        title: 'BFT & State Machine Safety Review',
        focusTopic: 'Byzantine Fault Tolerance & Replicated State Machines',
        startTime: friDate.toISOString(),
        endTime: new Date(friDate.getTime() + 90 * 60 * 1000).toISOString(),
        location: 'Study Hub Alpha',
        priority: 'HIGH',
      },
    ];
  }

  const results: SavedSessionResult[] = [];
  let conflictsCount = 0;

  for (const session of sessionsToSchedule) {
    const startDate = new Date(session.startTime);
    const endDate = new Date(session.endTime);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error(`Invalid session date range for "${session.title}".`);
    }

    if (startDate >= endDate) {
      throw new Error(`Start time must be before end time for session: "${session.title}".`);
    }

    const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));

    // Check for overlap against existing database sessions
    const { hasOverlap, conflictingSession } = await detectSessionOverlap(startDate, endDate, session.id);

    let status: 'CONFIRMED' | 'CONFLICT' = 'CONFIRMED';
    let conflictDetails: string | undefined = undefined;

    if (hasOverlap && conflictingSession) {
      conflictsCount++;
      status = 'CONFLICT';
      conflictDetails = `Conflicts with existing session "${conflictingSession.title}" (${conflictingSession.startTime.toLocaleTimeString()} - ${conflictingSession.endTime.toLocaleTimeString()})`;
      
      if (!input.auto_resolve_conflicts) {
        // Record as conflict without writing a confirmed block
        results.push({
          id: session.id || 'unpersisted-conflict',
          title: session.title,
          focusTopic: session.focusTopic,
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
          durationMinutes,
          location: session.location || 'Quiet Study 3B',
          priority: session.priority || 'HIGH',
          status: 'CONFLICT',
          conflictDetails,
          persisted_and_verified: false,
        });
        continue;
      }
    }

    // Upsert or create session in database
    const saved = await prisma.studySession.create({
      data: {
        workflowId: input.workflow_id || null,
        planId: input.plan_id || null,
        title: session.title,
        focusTopic: session.focusTopic,
        startTime: startDate,
        endTime: endDate,
        durationMinutes,
        location: session.location || 'Quiet Study 3B',
        priority: session.priority || 'HIGH',
        status: 'CONFIRMED',
        conflictDetails: null,
        verified: true,
      },
    });

    // Verification check: read back from persistent storage
    const verified = await verifyPersistence('session', saved.id);

    results.push({
      id: saved.id,
      title: saved.title,
      focusTopic: saved.focusTopic,
      startTime: saved.startTime.toISOString(),
      endTime: saved.endTime.toISOString(),
      durationMinutes: saved.durationMinutes,
      location: saved.location,
      priority: saved.priority,
      status: 'CONFIRMED',
      persisted_and_verified: verified,
    });
  }

  const allPersisted = results.filter(r => r.persisted_and_verified).length;

  return {
    status: conflictsCount > 0 ? 'CONFLICT_DETECTED' : 'PERSISTED',
    total_submitted: sessionsToSchedule.length,
    total_persisted: allPersisted,
    conflicts_detected: conflictsCount,
    confirmed_sessions: results,
    verification_status: allPersisted === sessionsToSchedule.length
      ? '100% Writes Verified via Read-Back'
      : `${allPersisted}/${sessionsToSchedule.length} Verified`,
    calendar_sync_note: 'Saved directly to internal database. Ready for iCal / Alexa+ calendar export.',
  };
}
