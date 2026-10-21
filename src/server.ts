import express from 'express';
import cors from 'cors';
import path from 'node:path';
import dotenv from 'dotenv';
import { apiRouter } from './api/routes.js';
import { createNexusMCPServer } from './mcp/server.js';
import { prisma } from './db/prisma.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Global Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize the real MCP Server with Streamable HTTP transport
const mcpInstance = createNexusMCPServer();

// Streamable HTTP endpoint for the MCP protocol (spec 2025-11-25+)
app.all('/mcp', async (req, res) => {
  try {
    await mcpInstance.handleHttpRequest(req, res);
  } catch (err: any) {
    console.error('[MCP Transport Error]', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal MCP transport error', details: err.message });
    }
  }
});

// REST API routes
app.use('/api', apiRouter);

// Serve static frontend assets from public directory
const publicDir = path.resolve(process.cwd(), 'public');
app.use(express.static(publicDir));

// Fallback for Single Page App routing
app.get('*', (_req, res, next) => {
  if (_req.path.startsWith('/api') || _req.path.startsWith('/mcp')) {
    return next();
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`   NEXUS AI — Alexa+ Hackathon Gateway 2026`);
  console.log(`   "One Conversation. Multiple Actions."`);
  console.log(`================================================================`);
  console.log(`   Web Application:    http://localhost:${PORT}`);
  console.log(`   REST API:           http://localhost:${PORT}/api/status`);
  console.log(`   MCP Streamable HTTP: http://localhost:${PORT}/mcp`);
  console.log(`   Database:           SQLite (Prisma ORM)`);
  console.log(`================================================================\n`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down Nexus AI...');
  server.close();
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
