import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

// Tool implementations
import { executeSearchKnowledge } from './tools/searchKnowledge.js';
import { executeExtractImportantTopics } from './tools/extractTopics.js';
import { executeCreateRevisionPlan } from './tools/createRevisionPlan.js';
import { executeScheduleStudySessions } from './tools/scheduleSessions.js';
import { executeGenerateQuiz } from './tools/generateQuiz.js';
import { executeGetWorkflowStatus } from './tools/getWorkflowStatus.js';

export interface MCPServerInstance {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  handleHttpRequest: (req: Request, res: Response) => Promise<void>;
}

/**
 * Creates and registers all 6 official Nexus AI MCP tools targeting MCP spec 2025-11-25+.
 */
export function createNexusMCPServer(): MCPServerInstance {
  const server = new McpServer({
    name: 'Nexus-AI-MCP-Server',
    version: '1.4.0',
  });

  // Tool 1: search_knowledge
  server.registerTool(
    'search_knowledge',
    {
      description: 'Retrieve semantically grounded passages from indexed student lecture notes and curated OKF collections using hybrid vector-keyword RAG.',
      inputSchema: {
        query: z.string().describe('Search query, e.g. "consensus invariants" or "vector clocks causality"'),
        category: z.enum(['user', 'curated', 'all']).optional().describe('Source filtering: user notes or curated OKF foundations'),
        limit: z.number().int().min(1).max(20).optional().describe('Maximum number of passages to return (default 5)'),
        threshold: z.number().min(0).max(1).optional().describe('Relevance similarity threshold (0.0 to 1.0)'),
      },
    },
    async (args) => {
      try {
        const result = await executeSearchKnowledge(args as any);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
        };
      }
    }
  );

  // Tool 2: extract_important_topics
  server.registerTool(
    'extract_important_topics',
    {
      description: 'Synthesize extracted study notes into structured concept hierarchies, high-yield exam domains, and priority estimates.',
      inputSchema: {
        passages: z.array(z.string()).optional().describe('List of retrieved passage texts or source notes to inspect'),
        course_context: z.string().optional().describe('Course name or subject code (e.g. "CS452 Distributed Systems")'),
        exam_date: z.string().optional().describe('Target exam date or deadline'),
      },
    },
    async (args) => {
      try {
        const result = await executeExtractImportantTopics(args as any);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
        };
      }
    }
  );

  // Tool 3: create_revision_plan
  server.registerTool(
    'create_revision_plan',
    {
      description: 'Generate a structured chronological revision plan with milestones, daily allocations, and learning objectives leading up to an exam.',
      inputSchema: {
        topics: z.array(z.object({
          id: z.string().optional(),
          name: z.string(),
          priority: z.string().optional(),
        })).describe('List of extracted topics to allocate across study milestones'),
        exam_date: z.string().describe('Target exam date (e.g. "Friday" or ISO 8601 date)'),
        available_hours: z.number().positive().optional().describe('Total available study hours across the revision window (default 8.5)'),
        session_duration_minutes: z.number().int().positive().optional().describe('Preferred duration for individual study blocks in minutes'),
      },
    },
    async (args) => {
      try {
        const result = await executeCreateRevisionPlan(args as any);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
        };
      }
    }
  );

  // Tool 4: schedule_study_sessions
  server.registerTool(
    'schedule_study_sessions',
    {
      description: 'Validate proposed study sessions against the student timetable for conflicts, and persist confirmed study blocks to database storage.',
      inputSchema: {
        workflow_id: z.string().optional().describe('Workflow identifier to link saved sessions'),
        plan_id: z.string().optional().describe('Revision plan identifier'),
        sessions: z.array(z.object({
          title: z.string(),
          focusTopic: z.string(),
          startTime: z.string(),
          endTime: z.string(),
          location: z.string().optional(),
          priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM']).optional(),
        })).optional().describe('Array of proposed study session objects with start and end times'),
        auto_resolve_conflicts: z.boolean().optional().describe('If true, auto-resolves conflicts by adjusting slot times'),
      },
    },
    async (args) => {
      try {
        const result = await executeScheduleStudySessions(args as any);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
        };
      }
    }
  );

  // Tool 5: generate_quiz
  server.registerTool(
    'generate_quiz',
    {
      description: 'Generate targeted diagnostic multiple-choice quiz questions with verified answer keys, citations, and algorithmic rationale.',
      inputSchema: {
        workflow_id: z.string().optional().describe('Workflow identifier to associate with the quiz'),
        course: z.string().optional().describe('Target course (e.g. "CS452 Distributed Systems")'),
        topics: z.array(z.string()).optional().describe('Topics to focus questions on'),
        question_count: z.number().int().min(1).max(20).optional().describe('Number of questions to produce (default 5)'),
        difficulty: z.enum(['easy', 'medium', 'hard']).optional().describe('Question difficulty level (default "hard")'),
        persist: z.boolean().optional().describe('Whether to persist the generated quiz to the database (default true)'),
      },
    },
    async (args) => {
      try {
        const result = await executeGenerateQuiz(args as any);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
        };
      }
    }
  );

  // Tool 6: get_workflow_status
  server.registerTool(
    'get_workflow_status',
    {
      description: 'Query the real-time execution status, step timeline, latency, and verified database references of an autonomous workflow run.',
      inputSchema: {
        workflow_id: z.string().describe('Workflow database ID or run identifier (e.g. "RUN-8821B")'),
      },
    },
    async (args) => {
      try {
        const result = await executeGetWorkflowStatus(args as any);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
        };
      }
    }
  );

  // Streamable HTTP transport configured according to MCP Specification 2025-11-25+
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => `mcp-session-${randomUUID()}`,
  });

  // Connect server to transport
  server.connect(transport).catch(err => {
    console.error('Failed to connect MCP server to Streamable HTTP transport:', err);
  });

  return {
    server,
    transport,
    handleHttpRequest: async (req: Request, res: Response) => {
      await transport.handleRequest(req, res, req.body);
    },
  };
}

// Standalone execution entrypoint
if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  const { server } = createNexusMCPServer();
  console.log('Nexus AI MCP Server initialized with 6 tools:');
  console.log('- search_knowledge');
  console.log('- extract_important_topics');
  console.log('- create_revision_plan');
  console.log('- schedule_study_sessions');
  console.log('- generate_quiz');
  console.log('- get_workflow_status');
}
