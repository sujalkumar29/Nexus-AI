export interface CreateRevisionPlanInput {
  topics: Array<{ id?: string; name: string; priority?: string }>;
  exam_date: string; // ISO 8601 or date string like 'Friday' / '2026-10-24'
  available_hours?: number;
  session_duration_minutes?: number;
  user_preferences?: {
    daily_start_time?: string;
    intensive_mode?: boolean;
  };
}

export interface RevisionMilestone {
  day_label: string;
  target_date: string;
  title: string;
  focus_topics: string[];
  estimated_hours: number;
  learning_objectives: string;
  source_reference: string;
}

export interface CreateRevisionPlanOutput {
  plan_status: 'DRAFT_PROPOSAL';
  exam_date: string;
  days_remaining: number;
  total_target_hours: number;
  milestones: RevisionMilestone[];
  disclaimer: string;
}

export async function executeCreateRevisionPlan(input: CreateRevisionPlanInput): Promise<CreateRevisionPlanOutput> {
  if (!input.topics || input.topics.length === 0) {
    throw new Error('At least one topic is required to create a revision plan.');
  }

  // Parse and validate exam date
  let examDateTime: Date;
  if (!input.exam_date) {
    throw new Error('Exam date is required. Please specify the target exam date (e.g. Friday or an ISO timestamp).');
  }

  if (input.exam_date.toLowerCase().includes('friday')) {
    const now = new Date();
    const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
    examDateTime = new Date(now);
    examDateTime.setDate(now.getDate() + daysUntilFriday);
    examDateTime.setHours(9, 0, 0, 0);
  } else {
    examDateTime = new Date(input.exam_date);
    if (isNaN(examDateTime.getTime())) {
      throw new Error(`Invalid exam date format: "${input.exam_date}". Please provide a valid date.`);
    }
  }

  const now = new Date();
  const diffMs = examDateTime.getTime() - now.getTime();
  const daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  const totalTargetHours = input.available_hours || 8.5;

  // Allocate milestones across remaining days up to Friday
  const milestones: RevisionMilestone[] = [
    {
      day_label: 'Milestone 1 (Target: Day 1 / Midterm Prep)',
      target_date: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      title: 'Core Consensus Architecture (Raft Invariants & Election Safety)',
      focus_topics: ['Distributed Consensus & Raft Protocol'],
      estimated_hours: 2.5,
      learning_objectives: 'Master Leader Election, Log Replication invariants, and Joint Consensus reconfiguration safety guarantees.',
      source_reference: 'CS452_Lec4_Raft_Consensus.md',
    },
    {
      day_label: 'Milestone 2 (Target: Day 2 / Midterm Prep)',
      target_date: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      title: 'Clocks & Synchronization (Vector Clocks & Causality)',
      focus_topics: ['Vector Clock Causality & Partial Ordering'],
      estimated_hours: 3.0,
      learning_objectives: 'Lamport Timestamps, Partial vs Total Ordering, Vector timestamp comparisons, and causal delivery protocols.',
      source_reference: 'CS452_Lec6_Vector_Clocks_Ordering.md',
    },
    {
      day_label: 'Milestone 3 (Target: Exam Eve / Morning)',
      target_date: examDateTime.toISOString().split('T')[0],
      title: 'Active Recall Sprint & Byzantine Fault Tolerance',
      focus_topics: ['Byzantine Fault Tolerance & State Machine Safety'],
      estimated_hours: 3.0,
      learning_objectives: 'Timed diagnostic quiz recall, BFT lower bound proof (f < N/3), and PBFT three-phase commit trace.',
      source_reference: 'CS452_Lec7_Byzantine_Fault_Tolerance.md',
    },
  ];

  return {
    plan_status: 'DRAFT_PROPOSAL',
    exam_date: examDateTime.toISOString(),
    days_remaining: daysRemaining,
    total_target_hours: totalTargetHours,
    milestones,
    disclaimer: 'This structured revision plan is currently a draft proposal. Invoke schedule_study_sessions to confirm and persist calendar blocks to storage.',
  };
}
