# NEXUS AI — "One Conversation. Multiple Actions."

> Built for the **Amazon Developer Hackathon 2026 — Alexa+ Track**  
> Autonomous AI Agent with Real Model Context Protocol (MCP) Streamable HTTP Server, Hybrid RAG Retrieval, and Verified Persistent Execution.

---

## 1. Project Overview

**Nexus AI** is an intelligent agent designed for the next generation of voice and multimodal assistants (Alexa+). While legacy assistants stop at single-turn answers or isolated commands, Nexus AI decomposes complex natural-language goals into coordinated multi-step tool calls, executes them via an official **Model Context Protocol (MCP)** server over **Streamable HTTP**, grounds decisions in student lecture notes and curated Open Knowledge Format (OKF) repositories via **Retrieval-Augmented Generation (RAG)**, and **verifies that all writes are physically committed to persistent storage** before reporting success.

### Hackathon Core Demonstration
The system provides out-of-the-box support for the canonical exam-preparation request:
> *"I have an exam on Friday. Find important topics in my notes, create a revision plan, schedule study sessions, and generate a quiz."*

### Key Highlights
- **Real MCP Server (Spec 2025-11-25+)**: Official `@modelcontextprotocol/sdk` v1.32.1 server utilizing **Streamable HTTP transport** at `/mcp`.
- **6 Registered MCP Tools**: `search_knowledge`, `extract_important_topics`, `create_revision_plan`, `schedule_study_sessions`, `generate_quiz`, and `get_workflow_status`.
- **Real MCP Client**: Automatically discovers server capabilities and invokes tools across network transport with bounded latency tracking.
- **RAG & OKF Pipeline**: Document chunking, hybrid vector/keyword search, grounded source citations, and Open Knowledge Format frontmatter validation.
- **Verified SQLite Persistence**: Prisma ORM with 10 relational models and read-back database audit checks (`verifyPersistence`).
- **Faithful Stitch UI**: Fluid dark-mode interface with animated AI Orb, interactive JSON tool payload drawers, document management, calendar timeline, and quiz studio.
- **100% Stitch Source Independence**: The UI runs directly from self-contained `public/` assets with zero imports or runtime ties to `stitch_nexus_ai_productivity_suite/`.

---

## 2. Architecture & System Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NEXUS AI CLIENT / FRONTEND                         │
│  (Stitch-Designed UI: Animated Orb, Tool Call Drawers, Quiz & Planner View) │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / REST / Voice RPC
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       EXPRESS 4 UNIFIED BACKEND SERVER                      │
│             (/api/chat, /api/status, /api/documents, /api/workflows)         │
└──────────────────┬───────────────────────────────────┬──────────────────────┘
                   │                                   │
                   ▼                                   ▼
┌──────────────────────────────────────┐  ┌───────────────────────────────────┐
│     AUTONOMOUS AGENT ORCHESTRATOR    │  │       RAG & RETRIEVAL ENGINE      │
│ - Intent Decomposition & Bounding    │  │ - Ingestion (.md, .txt, .pdf)     │
│ - Conflict Detection & Verification  │  │ - Deterministic Local Embeddings  │
│ - Provenance & Workflow State Audit  │  │ - OKF (Open Knowledge Format)     │
└──────────────────┬───────────────────┘  └─────────────────┬─────────────────┘
                   │                                        │
                   ▼ (Invokes via MCP Client)               │ (Searches Passages)
┌───────────────────────────────────────────────────────────┴─────────────────┐
│            OFFICIAL MODEL CONTEXT PROTOCOL (MCP) SERVER                     │
│               Streamable HTTP Transport (Spec 2025-11-25+)                  │
│                               Endpoint: /mcp                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  [1] search_knowledge          [4] schedule_study_sessions                  │
│  [2] extract_important_topics  [5] generate_quiz                            │
│  [3] create_revision_plan      [6] get_workflow_status                      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Verified Read-Back Queries
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PERSISTENT STORAGE: SQLITE VIA PRISMA                    │
│ KnowledgeSource | DocumentChunk | Workflow | WorkflowStep | RevisionPlan   │
│ StudySession | Quiz | QuizQuestion | QuizAttempt | QuizAnswer               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

- **Runtime**: Node.js (v18+) with TypeScript (ESM / NodeNext)
- **Protocol**: `@modelcontextprotocol/sdk` (v1.32.1)
- **Web Framework**: Express 4 with CORS and Multer
- **Database**: SQLite via Prisma ORM (`@prisma/client` v6.4.1)
- **Validation**: Zod (v3.24.2)
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3 with Tailwind-compatible Stitch design tokens, Material Symbols, Google Outfit / JetBrains Mono fonts.

---

## 4. Setup and Installation

### Prerequisites
- Node.js 18 or higher installed on Windows, macOS, or Linux.
- Git.

### 1. Clone the repository
```bash
git clone https://github.com/sujalkumar29/Nexus-AI.git
cd "Nexus AI"
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Copy the example environment configuration:
```bash
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

Default configuration (`.env`):
```ini
PORT=3001
DATABASE_URL="file:./dev.db"
MCP_SERVER_URL="http://localhost:3001/mcp"
NODE_ENV=development
```

### 4. Initialize and seed database
Generate Prisma client, push database schema, and seed test lecture notes:
```bash
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
```
This populates the database with:
- 4 CS452 Distributed Systems lecture notes (Raft Consensus, Vector Clocks, Byzantine Fault Tolerance, Midterm Syllabus).
- 2 Open Knowledge Format (OKF) curated foundation modules.
- Pre-computed embeddings and 24 searchable chunks.
- Baseline demo workflow `RUN-8821B` with verified revision plan, 3 study sessions, and diagnostic Quiz `QZ-409`.

---

## 5. Running the Application

### Development Server (Recommended)
Starts the unified server hosting the web application, REST API, and MCP Streamable HTTP transport:
```bash
npm run dev
```
Navigate to:
- **Web UI**: [http://localhost:3001](http://localhost:3001)
- **REST Status**: [http://localhost:3001/api/status](http://localhost:3001/api/status)
- **MCP Streamable HTTP Endpoint**: [http://localhost:3001/mcp](http://localhost:3001/mcp)

### Standalone MCP Server
To run or inspect the MCP server entrypoint in isolation:
```bash
npm run mcp
```

### Production Build
```bash
npm run build
npm start
```

---

## 6. Model Context Protocol (MCP) Integration

Nexus AI implements a genuine MCP server targeting the **MCP Specification 2025-11-25 or later**, utilizing the official TypeScript SDK.

### Transport: Streamable HTTP
- **Endpoint**: `/mcp`
- **Server Implementation**: `StreamableHTTPServerTransport` in `src/mcp/server.ts`
- **Client Implementation**: `StreamableHTTPClientTransport` in `src/mcp/client.ts`
- **Session Management**: Session tokens are assigned via cryptographic UUIDs with full request/response multiplexing.

### Registered MCP Tools

| Tool Name | Purpose | Key Inputs | Key Outputs |
| :--- | :--- | :--- | :--- |
| `search_knowledge` | Hybrid RAG retrieval across notes & OKF items | `query`, `category`, `limit`, `threshold` | Grounded passages, similarity scores, source metadata |
| `extract_important_topics` | Synthesizes core concept domains with citations | `passages`, `course_context` | Topic names, explanations, priority estimates, citations |
| `create_revision_plan` | Generates chronological study milestones | `topics`, `exam_date`, `available_hours` | Draft plan, milestones, daily hour allocations |
| `schedule_study_sessions` | Validates time slots, checks conflicts, commits to DB | `sessions`, `plan_id`, `timezone` | Persisted session IDs, conflict reports, verification flag |
| `generate_quiz` | Generates diagnostic questions with Zod schema checks | `topics`, `question_count`, `difficulty` | Questions, choices, correct answers, rationales, citations |
| `get_workflow_status` | Inspects real database workflow execution timeline | `workflow_id` | Status (`COMPLETED`), timeline, persisted entity IDs |

---

## 7. RAG & Knowledge Retrieval Engine

The RAG pipeline (`src/rag/`) enforces rigorous grounding to prevent model hallucinations:

1. **Ingestion (`src/rag/ingestion.ts`)**: Supports `.md`, `.txt`, and `.pdf` files. Validates file types and sizes (<10MB).
2. **Chunking**: Text is split into overlapping passages (average 350 tokens, 50-token stride) preserving section headers.
3. **Embeddings & Vector Matching (`src/rag/retriever.ts`)**: Computes deterministic TF-IDF / term-frequency semantic embeddings with cosine similarity.
4. **Keyword Intersect**: Performs exact-term frequency boosting for technical vocabulary (e.g., *Raft*, *Quorum*, *Byzantine*).
5. **Empty Results Handling**: When no passages meet the threshold, returns `total_matches: 0` without fabricating citations.

### Curated Open Knowledge Format (OKF) Support
Nexus AI supports the **Open Knowledge Format (OKF v1.0.0)** for curated foundations in `data/okf/`:
- Validates YAML frontmatter (`id`, `title`, `description`, `version`, `tags`, `license`).
- Ingested directly into the RAG vector index alongside user lecture notes.

---

## 8. Verification & Database Schema

Every write operation is verified by reading back the committed row from the SQLite database (`verifyPersistence` in `src/db/prisma.ts`).

### Schema Models (`prisma/schema.prisma`):
- `KnowledgeSource`: Stored lecture notes and OKF modules.
- `DocumentChunk`: Text chunks with token counts and pre-computed embeddings.
- `Workflow`: High-level run records (`RUN-XXXX`) with status and latency.
- `WorkflowStep`: Fine-grained tool execution audit log with inputs, outputs, and status.
- `RevisionPlan`: Structured study plan milestones and target hours.
- `StudySession`: Scheduled calendar events with start/end timestamps and conflict flags.
- `Quiz` & `QuizQuestion`: Diagnostic quizzes with multiple-choice options, rationales, and citations.
- `QuizAttempt` & `QuizAnswer`: User quiz submissions and scored answers.

---

## 9. Comprehensive Test Suite

Nexus AI includes 17 automated tests covering all required evaluation criteria across unit, persistence, and live transport layers:

```bash
npm test
```

### Test Coverage Summary:
```
▶ Nexus AI Comprehensive Test Suite
  ✔ 1. MCP server startup & tool discovery: lists all 6 registered tools (74ms)
  ✔ 2. Successful knowledge search: returns grounded passages for consensus query (7ms)
  ✔ 3. Retrieval with no matching content: returns empty result without fabricating sources (6ms)
  ✔ 4. Invalid tool arguments: rejects empty search query and invalid exam dates gracefully (1ms)
  ✔ 5. Topic extraction: extracts high-yield topics with grounded source references (4ms)
  ✔ 6. Revision plan creation: allocates study milestones up to exam date (0.5ms)
  ✔ 7. Scheduling conflict detection: identifies overlapping time slots (4ms)
  ✔ 8. Database persistence: verifies writes by reading back from storage (14ms)
  ✔ 9. Quiz question schema validation: validates required fields, choices, and rationale (3ms)
  ✔ 10. Workflow status retrieval: returns real DB workflow record and timeline (4ms)
  ✔ 11. Missing inputs handling: prompts user when exam date is missing (1ms)
  ✔ 12. OKF curated knowledge validation: parses YAML frontmatter and verifies required metadata (0.2ms)
  ✔ 13. Complete exam preparation workflow: executes 6 MCP tools, checks conflicts, and verifies persistence (148ms)

▶ MCP Streamable HTTP Transport Integration
  ✔ Connects to MCP Server via Streamable HTTP and discovers all 6 tools (159ms)
  ✔ Invokes search_knowledge over MCP Streamable HTTP transport (56ms)
  ✔ Invokes extract_important_topics over MCP Streamable HTTP transport (13ms)
  ✔ Invokes create_revision_plan over MCP Streamable HTTP transport (7ms)

Total: 17 passed, 0 failed (1.4s duration)
```

---

## 10. Complete Demo Walkthrough

1. Open **[http://localhost:3001](http://localhost:3001)**.
2. Observe the animated **Nexus AI Orb** and real-time telemetry:
   - System Latency: ~21ms
   - Active MCP Tools: 6
   - Indexed Documents: 6
3. Click **"Run Friday Exam Demo"** (or click the microphone icon for the simulated Alexa+ Voice RPC).
4. Prompt submitted:
   > *"I have an exam on Friday. Find important topics in my notes, create a revision plan, schedule study sessions, and generate a quiz."*
5. Watch the autonomous execution pipeline execute in real time:
   - **Step 1 (`understanding_intent`)**: Extracts target exam date ("Friday") and study scope.
   - **Step 2 (`search_knowledge`)**: Queries RAG for distributed systems topics (matches Raft, Vector Clocks, BFT).
   - **Step 3 (`extract_important_topics`)**: Extracts 3 critical topics with file provenance.
   - **Step 4 (`create_revision_plan`)**: Allocates 8.5 study hours across 3 milestones leading up to Friday.
   - **Step 5 (`schedule_study_sessions`)**: Tests calendar slots for conflicts and persists 3 confirmed sessions.
   - **Step 6 (`generate_quiz`)**: Generates 5 multiple-choice questions validated against the Zod schema.
   - **Step 7 (`get_workflow_status`)**: Confirms all records exist in SQLite and renders execution history.
6. Click any tool step in the UI to expand the **Tool Call Schema & Return** drawer to inspect the exact JSON input/output payload.
7. Switch tabs to:
   - **Documents**: Upload your own `.md` / `.txt` / `.pdf` or search indexed notes.
   - **Planner**: View study session milestones and calendar blocks.
   - **Quiz Studio**: Take the generated quiz, select answers, and receive instant explanations with citation references.
   - **Workflows**: Inspect complete execution history across past runs.

---

## 11. Stitch Folder Independence Report

In accordance with hackathon requirements:
- The original design folder `stitch_nexus_ai_productivity_suite/` was analyzed as a read-only reference.
- All styles, layout structures, icons, and fonts were ported cleanly into self-contained files in `public/` (`index.html`, `css/style.css`, `js/app.js`).
- There are **zero import statements, asset references, or runtime dependencies** pointing to `stitch_nexus_ai_productivity_suite/`.
- The folder is excluded from Git via `.gitignore`.
- **Verdict**: The application builds, passes all tests, and runs in production completely independently. The original `stitch_nexus_ai_productivity_suite/` folder can safely be retained for reference or deleted without affecting application operation.

---

## 12. Known Limitations & Scope

- **Single-User Local Scope**: Designed for local hackathon evaluation. Uses SQLite without multi-tenant authentication.
- **Calendar Writes**: Conflict detection and session scheduling are fully persisted to the internal database; integration with external Google Calendar/Outlook APIs would require third-party OAuth tokens.
- **Embedding Provider**: Includes deterministic high-efficiency local embeddings to allow 100% offline testing without mandatory third-party API keys. An OpenAI embedding adapter is pre-wired if an `OPENAI_API_KEY` is provided.

---

## 13. License
MIT License. Built with pride for the Amazon Developer Hackathon 2026.
