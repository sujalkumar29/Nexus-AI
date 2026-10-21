import { prisma } from '../../db/prisma.js';

export interface GetWorkflowStatusInput {
  workflow_id: string;
}

export interface WorkflowTimelineStep {
  step_index: number;
  tool_name: string;
  status: string;
  latency_ms: number;
  verified: boolean;
  input_preview: any;
  output_preview: any;
  error?: string | null;
  created_at: string;
}

export interface GetWorkflowStatusOutput {
  id: string;
  run_id: string;
  title: string;
  goal: string;
  status: string;
  exam_date: string | null;
  target_hours: number | null;
  total_latency_ms: number;
  total_steps: number;
  timeline: WorkflowTimelineStep[];
  persisted_entities: {
    plan_id?: string;
    session_ids: string[];
    quiz_code?: string;
  };
  created_at: string;
  updated_at: string;
}

export async function executeGetWorkflowStatus(input: GetWorkflowStatusInput): Promise<GetWorkflowStatusOutput> {
  if (!input.workflow_id || input.workflow_id.trim().length === 0) {
    throw new Error('Workflow identifier is required.');
  }

  const queryId = input.workflow_id.trim();

  // Search by either database ID or runId (e.g. RUN-8821B)
  const workflow = await prisma.workflow.findFirst({
    where: {
      OR: [
        { id: queryId },
        { runId: queryId },
      ],
    },
    include: {
      steps: {
        orderBy: { stepIndex: 'asc' },
      },
      revisionPlan: true,
      studySessions: true,
      quiz: true,
    },
  });

  if (!workflow) {
    throw new Error(`Workflow with identifier "${queryId}" was not found in persistent storage.`);
  }

  const timeline: WorkflowTimelineStep[] = workflow.steps.map(s => {
    let inputPreview: any = null;
    let outputPreview: any = null;
    try {
      inputPreview = JSON.parse(s.inputPayload);
    } catch {
      inputPreview = s.inputPayload;
    }
    try {
      outputPreview = JSON.parse(s.outputPayload);
    } catch {
      outputPreview = s.outputPayload;
    }

    return {
      step_index: s.stepIndex,
      tool_name: s.toolName,
      status: s.status,
      latency_ms: s.latencyMs,
      verified: s.verified,
      input_preview: inputPreview,
      output_preview: outputPreview,
      error: s.error,
      created_at: s.createdAt.toISOString(),
    };
  });

  return {
    id: workflow.id,
    run_id: workflow.runId,
    title: workflow.title,
    goal: workflow.goal,
    status: workflow.status,
    exam_date: workflow.examDate ? workflow.examDate.toISOString() : null,
    target_hours: workflow.targetHours,
    total_latency_ms: workflow.latencyMs,
    total_steps: timeline.length,
    timeline,
    persisted_entities: {
      plan_id: workflow.revisionPlan?.id,
      session_ids: workflow.studySessions.map(s => s.id),
      quiz_code: workflow.quiz?.quizCode,
    },
    created_at: workflow.createdAt.toISOString(),
    updated_at: workflow.updatedAt.toISOString(),
  };
}
