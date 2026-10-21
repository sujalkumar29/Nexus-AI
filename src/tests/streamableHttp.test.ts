import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createNexusMCPServer } from '../mcp/server.js';
import { NexusMCPClient } from '../mcp/client.js';
import type { Server } from 'node:http';

describe('MCP Streamable HTTP Transport Integration', () => {
  let appServer: Server;
  const testPort = 3099;
  let client: NexusMCPClient;

  before(async () => {
    const app = express();
    app.use(express.json());
    const mcpInstance = createNexusMCPServer();

    app.all('/mcp', async (req, res) => {
      await mcpInstance.handleHttpRequest(req, res);
    });

    await new Promise<void>((resolve) => {
      appServer = app.listen(testPort, () => {
        resolve();
      });
    });

    client = new NexusMCPClient(`http://localhost:${testPort}/mcp`);
  });

  after(async () => {
    try {
      if (client) await client.close();
      if (appServer) {
        await new Promise<void>((resolve) => {
          appServer.close(() => resolve());
        });
      }
    } catch {}
  });

  test('Connects to MCP Server via Streamable HTTP and discovers all 6 tools', async () => {
    const tools = await client.discoverTools();
    assert.ok(Array.isArray(tools));
    assert.strictEqual(tools.length, 6);
  });

  test('Invokes search_knowledge over MCP Streamable HTTP transport', async () => {
    const result = await client.callTool('search_knowledge', {
      query: 'Raft consensus leader election',
      limit: 2,
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.latencyMs >= 0);
    assert.ok(result.data.total_matches > 0);
    assert.ok(result.data.passages.length > 0);
  });

  test('Invokes extract_important_topics over MCP Streamable HTTP transport', async () => {
    const result = await client.callTool('extract_important_topics', {
      course_context: 'CS452 Distributed Systems',
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.data.topics.length >= 3);
  });

  test('Invokes create_revision_plan over MCP Streamable HTTP transport', async () => {
    const result = await client.callTool('create_revision_plan', {
      topics: [{ name: 'Distributed Consensus & Raft' }],
      exam_date: 'Friday',
      available_hours: 8.5,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.plan_status, 'DRAFT_PROPOSAL');
  });
});
