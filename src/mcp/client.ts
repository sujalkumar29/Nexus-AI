import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// Local tool implementations for reliable direct in-process bridge or test execution
import { executeSearchKnowledge } from './tools/searchKnowledge.js';
import { executeExtractImportantTopics } from './tools/extractTopics.js';
import { executeCreateRevisionPlan } from './tools/createRevisionPlan.js';
import { executeScheduleStudySessions } from './tools/scheduleSessions.js';
import { executeGenerateQuiz } from './tools/generateQuiz.js';
import { executeGetWorkflowStatus } from './tools/getWorkflowStatus.js';

export interface DiscoveredTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface ToolInvocationResult<T = any> {
  success: boolean;
  data: T;
  latencyMs: number;
  error?: string;
  transportUsed: 'streamable_http' | 'in_process';
}

export class NexusMCPClient {
  private client: Client;
  private serverUrl: URL;
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(serverUrl = 'http://localhost:3001/mcp') {
    this.serverUrl = new URL(serverUrl);
    this.client = new Client(
      {
        name: 'Nexus-AI-Orchestrator-Client',
        version: '1.4.0',
      },
      {
        capabilities: {},
      }
    );
  }

  /**
   * Connect to MCP server over Streamable HTTP transport.
   */
  public async connect(): Promise<boolean> {
    if (this.isConnected) return true;
    if (this.connectionPromise) {
      await this.connectionPromise;
      return this.isConnected;
    }

    this.connectionPromise = (async () => {
      try {
        const transport = new StreamableHTTPClientTransport(this.serverUrl);
        await this.client.connect(transport);
        this.isConnected = true;
      } catch (err: any) {
        console.warn(`[NexusMCPClient] Streamable HTTP connect to ${this.serverUrl} failed (${err.message}). Using high-fidelity direct MCP execution engine.`);
        this.isConnected = false;
      } finally {
        this.connectionPromise = null;
      }
    })();

    await this.connectionPromise;
    return this.isConnected;
  }

  /**
   * Close connection and release transport resources.
   */
  public async close(): Promise<void> {
    try {
      await this.client.close();
    } catch {}
    this.isConnected = false;
  }

  /**
   * Discover registered tools from the MCP server.
   */
  public async discoverTools(): Promise<DiscoveredTool[]> {
    const isOnline = await this.connect();
    if (isOnline) {
      try {
        const response = await this.client.listTools();
        return response.tools.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        }));
      } catch (err) {
        console.warn('[NexusMCPClient] listTools via transport failed, falling back to catalog:', err);
      }
    }

    // Direct tool definitions catalog matching server
    return [
      {
        name: 'search_knowledge',
        description: 'Retrieve semantically grounded passages from indexed student lecture notes and curated OKF collections using hybrid vector-keyword RAG.',
      },
      {
        name: 'extract_important_topics',
        description: 'Synthesize extracted study notes into structured concept hierarchies, high-yield exam domains, and priority estimates.',
      },
      {
        name: 'create_revision_plan',
        description: 'Generate a structured chronological revision plan with milestones, daily allocations, and learning objectives leading up to an exam.',
      },
      {
        name: 'schedule_study_sessions',
        description: 'Validate proposed study sessions against the student timetable for conflicts, and persist confirmed study blocks to database storage.',
      },
      {
        name: 'generate_quiz',
        description: 'Generate targeted diagnostic multiple-choice quiz questions with verified answer keys, citations, and algorithmic rationale.',
      },
      {
        name: 'get_workflow_status',
        description: 'Query the real-time execution status, step timeline, latency, and verified database references of an autonomous workflow run.',
      },
    ];
  }

  /**
   * Invokes an MCP tool with bounded execution, timing, and error handling.
   */
  public async callTool<T = any>(toolName: string, args: Record<string, any>): Promise<ToolInvocationResult<T>> {
    const startTime = Date.now();

    // 1. Try Streamable HTTP transport if connected
    const isOnline = await this.connect();
    if (isOnline) {
      try {
        const result = await this.client.callTool({
          name: toolName,
          arguments: args,
        });

        const latencyMs = Date.now() - startTime;
        const contentArray = (result.content as any[]) || [];
        const firstItem = contentArray[0];

        if (result.isError) {
          const errMsg = firstItem?.type === 'text' ? firstItem.text : 'Tool error';
          return {
            success: false,
            data: null as any,
            latencyMs,
            error: errMsg,
            transportUsed: 'streamable_http',
          };
        }

        const textOutput = firstItem?.type === 'text' ? firstItem.text : '{}';
        const parsed = JSON.parse(textOutput);
        return {
          success: true,
          data: parsed as T,
          latencyMs,
          transportUsed: 'streamable_http',
        };
      } catch (err: any) {
        console.warn(`[NexusMCPClient] Remote call to ${toolName} over Streamable HTTP failed (${err.message}). Falling back to direct verified execution.`);
      }
    }

    // 2. Direct verified execution fallback with identical implementation and validation
    try {
      let data: any = null;
      switch (toolName) {
        case 'search_knowledge':
          data = await executeSearchKnowledge(args as any);
          break;
        case 'extract_important_topics':
          data = await executeExtractImportantTopics(args as any);
          break;
        case 'create_revision_plan':
          data = await executeCreateRevisionPlan(args as any);
          break;
        case 'schedule_study_sessions':
          data = await executeScheduleStudySessions(args as any);
          break;
        case 'generate_quiz':
          data = await executeGenerateQuiz(args as any);
          break;
        case 'get_workflow_status':
          data = await executeGetWorkflowStatus(args as any);
          break;
        default:
          throw new Error(`Unrecognized MCP tool: "${toolName}"`);
      }

      const latencyMs = Date.now() - startTime;
      return {
        success: true,
        data: data as T,
        latencyMs,
        transportUsed: 'in_process',
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      return {
        success: false,
        data: null as any,
        latencyMs,
        error: err.message || 'Execution error',
        transportUsed: 'in_process',
      };
    }
  }
}

// Singleton MCP Client instance
export const mcpClient = new NexusMCPClient();
