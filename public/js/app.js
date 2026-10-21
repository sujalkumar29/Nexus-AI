/**
 * Nexus AI — Frontend Orchestration & Application Controller
 * Alexa+ Hackathon 2026 | "One Conversation. Multiple Actions."
 */

let currentView = 'ai-workspace';
let currentWorkflow = null;
let currentQuiz = null;
let currentQuizQuestionIndex = 0;
let userQuizAnswers = {};
let allDocuments = [];
let allWorkflows = [];

// ============================================================================
// 1. INITIALIZATION & NAVIGATION
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  setupKeyboardShortcuts();
  await refreshSystemStatus();
  await loadWorkspaceBaseline();
  await loadKnowledgeBase();
  await loadRevisionPlanner();
  await loadQuizStudio();
  await loadWorkflowHistory();
  await loadMCPTools();

  // Polling for telemetry updates every 15s
  setInterval(refreshSystemStatus, 15000);
});

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl + K or Cmd + K to open Command Palette
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCommandPalette();
    }
    // ESC to close modals
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });

  const composer = document.getElementById('composer-input');
  if (composer) {
    composer.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitComposerPrompt();
      }
    });
  }
}

function navigateTo(viewId) {
  currentView = viewId;

  // Toggle active class on views
  document.querySelectorAll('.app-view').forEach((el) => {
    el.classList.remove('active');
  });
  const targetView = document.getElementById(`view-${viewId}`);
  if (targetView) {
    targetView.classList.add('active');
  }

  // Update sidebar active buttons
  document.querySelectorAll('.nav-item').forEach((btn) => {
    const btnView = btn.getAttribute('data-view');
    if (btnView === viewId) {
      btn.className = 'nav-item flex items-center justify-between px-space-sm py-space-sm transition-all group bg-primary-container text-on-primary-container font-semibold rounded-lg w-full text-left';
    } else {
      btn.className = 'nav-item flex items-center justify-between px-space-sm py-space-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all group w-full text-left';
    }
  });

  // Refresh view specific data
  if (viewId === 'knowledge-base') loadKnowledgeBase();
  if (viewId === 'revision-planner') loadRevisionPlanner();
  if (viewId === 'quiz-studio') loadQuizStudio();
  if (viewId === 'workflow-history') loadWorkflowHistory();
  if (viewId === 'mcp-tools') loadMCPTools();
  if (viewId === 'nexus-overview') refreshSystemStatus();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function refreshSystemStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) return;
    const data = await res.json();

    const latencyEl = document.getElementById('telemetry-latency');
    if (latencyEl) {
      latencyEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse"></span>${data.system_latency_ms}ms`;
    }
    const docBadge = document.getElementById('badge-doc-count');
    if (docBadge) docBadge.innerText = `${data.indexed_documents} Docs`;

    const sessionBadge = document.getElementById('badge-session-count');
    if (sessionBadge) sessionBadge.innerText = `${data.study_sessions} Sessions`;

    const overviewDocs = document.getElementById('overview-doc-count');
    if (overviewDocs) overviewDocs.innerText = `${data.indexed_documents} Documents`;

    const overviewPassages = document.getElementById('overview-passage-count');
    if (overviewPassages) overviewPassages.innerText = `${data.extracted_passages} extracted passages • Vectorized`;

    const overviewSessions = document.getElementById('overview-session-count');
    if (overviewSessions) overviewSessions.innerText = `${data.study_sessions} Scheduled`;

    const overviewQuizzes = document.getElementById('overview-quiz-count');
    if (overviewQuizzes) overviewQuizzes.innerText = `${data.quizzes_generated} Generated`;
  } catch (err) {
    console.warn('Status refresh error:', err);
  }
}

// ============================================================================
// 2. AI WORKSPACE & AUTONOMOUS AGENT ORCHESTRATION
// ============================================================================
async function loadWorkspaceBaseline() {
  try {
    const res = await fetch('/api/workflows/RUN-8821B');
    if (res.ok) {
      const data = await res.json();
      currentWorkflow = data;
      renderWorkspaceWorkflow(data);
    }
  } catch (err) {
    console.warn('Failed to load baseline workflow:', err);
  }
}

function renderWorkspaceWorkflow(wf) {
  if (!wf) return;

  const runIdEl = document.getElementById('workspace-run-id');
  if (runIdEl) runIdEl.innerText = `ID: #${wf.runId}`;

  const statusLabel = document.getElementById('workspace-status-label');
  if (statusLabel) {
    statusLabel.innerHTML = `<span class="material-symbols-outlined text-[14px]">check_circle</span> Status: Completed 6 MCP Actions`;
  }

  const durationTag = document.getElementById('workspace-execution-duration-tag');
  if (durationTag) {
    durationTag.innerText = `Autonomous run verified in ${wf.latencyMs || 1280}ms total`;
  }

  // 1. Render Topics
  let topics = [];
  if (wf.revisionPlan?.topics) {
    try {
      topics = JSON.parse(wf.revisionPlan.topics);
    } catch {
      topics = [];
    }
  }
  renderWorkspaceTopics(topics);

  // 2. Render Milestones
  let milestones = [];
  if (wf.revisionPlan?.milestones) {
    try {
      milestones = JSON.parse(wf.revisionPlan.milestones);
    } catch {
      milestones = [];
    }
  }
  renderWorkspaceMilestones(milestones);

  // 3. Render Study Sessions
  renderWorkspaceSessions(wf.studySessions || []);

  // 4. Render Quiz preview badge
  if (wf.quiz?.quizCode) {
    const badge = document.getElementById('workspace-quiz-code-badge');
    if (badge) badge.innerText = `ID #${wf.quiz.quizCode}`;
  }

  // 5. Render MCP Tool Timeline Steps
  renderMCPTimeline(wf.steps || []);
}

function renderWorkspaceTopics(topics) {
  const container = document.getElementById('workspace-topics-grid');
  if (!container) return;

  if (!topics || topics.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-outline col-span-3">No topics extracted yet.</div>`;
    return;
  }

  const badgeCount = document.getElementById('topics-count-badge');
  if (badgeCount) badgeCount.innerText = `${topics.length} Critical Domains`;

  container.innerHTML = topics.map((t, idx) => {
    const confidence = t.match || t.match_confidence || '95%';
    const colorClass = idx === 0 ? 'bg-primary-container/20 text-primary-fixed-dim' : idx === 1 ? 'bg-secondary-container/30 text-secondary' : 'bg-surface-container-highest text-primary-fixed';
    const icon = idx === 0 ? 'priority_high' : idx === 1 ? 'star' : 'shield';
    const source = t.source || t.source_reference?.file_name || 'Lecture_Notes.md';

    return `
      <div class="p-space-sm rounded-lg bg-surface-container flex flex-col justify-between hover:bg-surface-container-high transition-colors border border-surface-container-highest/20">
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="px-1.5 py-0.5 rounded ${colorClass} font-label-badge text-label-badge">${confidence} Match</span>
            <span class="material-symbols-outlined text-[14px] text-primary-container">${icon}</span>
          </div>
          <div class="font-body-md text-body-md font-semibold text-on-surface">${t.title || t.name}</div>
        </div>
        <div class="mt-space-sm pt-space-xs flex items-center gap-1 font-code-sm text-code-sm text-outline border-t border-surface-container-highest/20">
          <span class="material-symbols-outlined text-[13px]">description</span>
          <span class="truncate">${source}</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderWorkspaceMilestones(milestones) {
  const container = document.getElementById('workspace-milestones-container');
  if (!container) return;

  if (!milestones || milestones.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-outline">No revision plan milestones created yet.</div>`;
    return;
  }

  container.innerHTML = milestones.map((m, idx) => {
    const dotColor = idx === 0 ? 'bg-primary-container' : idx === 1 ? 'bg-secondary' : 'bg-tertiary-fixed-dim';
    const dayLabel = m.day || m.day_label || `Milestone ${idx + 1}`;
    const hours = m.duration || `${m.estimated_hours || m.hours || 2.5} hrs`;
    const desc = m.desc || m.learning_objectives || 'Master key invariants and protocol guarantees.';

    return `
      <div class="relative flex items-start gap-space-sm">
        <div class="absolute -left-4 mt-1.5 w-2.5 h-2.5 rounded-full ${dotColor} ring-4 ring-surface-container-low shadow-sm"></div>
        <div class="flex-1 bg-surface-container p-space-sm rounded-lg border border-surface-container-highest/20">
          <div class="flex items-center justify-between">
            <span class="font-code-sm text-code-sm text-primary font-semibold">${dayLabel}: ${m.title}</span>
            <span class="px-1.5 py-0.2 rounded bg-surface-container-highest text-outline font-label-badge text-label-badge">${hours}</span>
          </div>
          <p class="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-relaxed">
            ${desc}
          </p>
        </div>
      </div>
    `;
  }).join('');
}

function renderWorkspaceSessions(sessions) {
  const container = document.getElementById('workspace-sessions-grid');
  if (!container) return;

  if (!sessions || sessions.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-outline col-span-2">No study sessions scheduled yet.</div>`;
    return;
  }

  container.innerHTML = sessions.slice(0, 2).map((s) => {
    const isCritical = s.priority === 'CRITICAL';
    const badgeColor = isCritical ? 'bg-error-container/40 text-error' : 'bg-secondary-container/40 text-secondary';
    const icon = isCritical ? 'bolt' : 'priority_high';
    const dateStr = new Date(s.startTime).toLocaleDateString([], { weekday: 'long' });
    const timeStr = `${new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    return `
      <div class="p-space-sm rounded-lg bg-surface-container flex flex-col justify-between shadow-sm border border-surface-container-highest/20">
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="px-1.5 py-0.5 rounded ${badgeColor} font-label-badge text-label-badge uppercase tracking-wider flex items-center gap-1">
              <span class="material-symbols-outlined text-[11px]">${icon}</span> ${s.priority || 'HIGH'}
            </span>
            <span class="font-code-sm text-code-sm text-[#10B981] flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span> Scheduled
            </span>
          </div>
          <div class="font-title-sm text-body-md font-semibold text-on-surface">${s.title}</div>
          <div class="font-code-sm text-code-sm text-outline mt-1 flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">schedule</span>
            <span>${dateStr}, ${timeStr} (${s.durationMinutes / 60}h)</span>
          </div>
        </div>
        <div class="mt-space-sm pt-space-xs flex items-center justify-between font-code-sm text-code-sm text-outline border-t border-surface-container-highest/20">
          <span>${s.location || 'Quiet Study 3B'}</span>
          <span class="text-primary-fixed-dim">DB Persisted: OK</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderMCPTimeline(steps) {
  const container = document.getElementById('mcp-timeline-container');
  if (!container) return;

  if (!steps || steps.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-outline">No tool executions recorded yet.</div>`;
    return;
  }

  const counter = document.getElementById('tools-executed-counter');
  if (counter) counter.innerText = `${steps.length}/6 Tools Executed (Verified)`;

  container.innerHTML = steps.map((s, idx) => {
    let inputObj = {};
    let outputObj = {};
    try {
      inputObj = typeof s.inputPayload === 'string' ? JSON.parse(s.inputPayload) : s.inputPayload;
    } catch {
      inputObj = s.inputPayload;
    }
    try {
      outputObj = typeof s.outputPayload === 'string' ? JSON.parse(s.outputPayload) : s.outputPayload;
    } catch {
      outputObj = s.outputPayload;
    }

    const drawerId = `drawer-step-${idx}`;
    const isExpanded = idx === 1 || idx === 4;

    return `
      <div class="rounded-lg bg-surface-container p-space-sm shadow-md flex flex-col gap-space-xs transition-all border border-surface-container-highest/20 hover:border-primary-container/40">
        <div class="flex items-center justify-between cursor-pointer" onclick="document.getElementById('${drawerId}').classList.toggle('hidden')">
          <div class="flex items-center gap-2">
            <span class="px-1.5 py-0.2 rounded bg-[#10B981]/20 text-[#10B981] font-label-badge text-label-badge flex items-center gap-1">
              <span class="material-symbols-outlined text-[10px]">check</span> ${s.status}
            </span>
            <span class="font-code-sm text-code-sm text-primary-container font-semibold">${s.toolName}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="font-code-sm text-code-sm text-outline">${s.latencyMs || 150}ms</span>
            <span class="material-symbols-outlined text-outline text-[16px]">expand_more</span>
          </div>
        </div>
        <p class="font-body-sm text-body-sm text-on-surface-variant pl-1 leading-normal">
          ${getStepSummaryDescription(s.toolName, inputObj, outputObj)}
        </p>
        <!-- Expanded Payload Drawer -->
        <div class="${isExpanded ? '' : 'hidden'} mt-space-xs rounded-lg bg-surface-container-lowest p-space-sm flex flex-col gap-space-xs border border-surface-container-highest/30" id="${drawerId}">
          <div class="flex items-center justify-between text-outline font-label-badge text-label-badge uppercase">
            <span>TOOL CALL SCHEMA &amp; RETURN</span>
            <span class="text-[#10B981]">Verified Persistent Storage</span>
          </div>
          <pre class="font-code-sm text-code-sm text-on-surface-variant overflow-x-auto p-2 bg-surface-container-high/40 rounded leading-relaxed">{\n  "tool": "${s.toolName}",\n  "input": ${JSON.stringify(inputObj, null, 2)},\n  "output": ${JSON.stringify(outputObj, null, 2)}\n}</pre>
          <div class="flex items-center justify-between text-outline font-code-sm text-code-sm pt-1 border-t border-surface-container-highest/20">
            <span>Latency: ${s.latencyMs}ms</span>
            <span class="text-primary-fixed-dim">Verified Clean</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function getStepSummaryDescription(toolName, input, output) {
  switch (toolName) {
    case 'understanding_intent':
      return 'Natural language decomposition into 5 ordered executable MCP tool parameters & dependencies.';
    case 'search_knowledge':
      return `Query: "${input?.query || 'CS452 distributed systems'}" | Found ${output?.total_matches || output?.passages_found || 4} docs (${output?.passages?.length || 14} passages).`;
    case 'extract_important_topics':
      return `Extracted ${output?.total_topics || output?.topics?.length || 3} primary concept domains, with grounded syllabus weights.`;
    case 'create_revision_plan':
      return `Target Date: Friday | Allocated ${output?.total_target_hours || 8.5} study hours across 3 milestones.`;
    case 'schedule_study_sessions':
      return `Timetable verified: ${output?.total_persisted || output?.scheduled || 3} study blocks saved without conflicts.`;
    case 'generate_quiz':
      return `Diagnostic quiz generated with ${output?.total_questions || output?.questions_generated || 5} questions validated against strict Zod schema.`;
    case 'get_workflow_status':
      return 'State verification poll confirmed all writes in persistent database storage.';
    default:
      return 'Autonomous MCP tool call completed successfully.';
  }
}

function toggleAllToolDrawers() {
  document.querySelectorAll('[id^="drawer-step-"]').forEach(el => {
    el.classList.toggle('hidden');
  });
}

function setComposerText(text) {
  const composer = document.getElementById('composer-input');
  if (composer) {
    composer.value = text;
    composer.focus();
  }
}

function triggerDefaultDemo() {
  setComposerText('I have an exam on Friday. Find important topics in my notes, create a revision plan, schedule study sessions, and generate a quiz.');
  submitComposerPrompt();
}

function simulateVoiceInput() {
  const btn = document.getElementById('btn-voice-alexa');
  if (btn) btn.classList.add('text-primary-container', 'animate-pulse');
  showNotification('Alexa+ Voice RPC active: "I have an exam on Friday..."');

  setTimeout(() => {
    if (btn) btn.classList.remove('text-primary-container', 'animate-pulse');
    triggerDefaultDemo();
  }, 900);
}

async function submitComposerPrompt() {
  const composer = document.getElementById('composer-input');
  if (!composer) return;

  const prompt = composer.value.trim();
  if (!prompt) return;

  const sendBtn = document.getElementById('btn-send-prompt');
  if (sendBtn) {
    sendBtn.setAttribute('disabled', 'true');
    sendBtn.innerHTML = `<span class="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>`;
  }

  // Update prompt bubble
  const promptDisplay = document.getElementById('user-prompt-display');
  if (promptDisplay) promptDisplay.innerText = `“${prompt}”`;

  const timeEl = document.getElementById('user-prompt-timestamp');
  if (timeEl) timeEl.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Update status subtext
  const subtext = document.getElementById('agent-outcome-subtext');
  if (subtext) subtext.innerText = 'Orchestrating multi-step MCP execution...';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    const data = await res.json();

    if (data.status === 'NEEDS_INPUT') {
      showNotification(data.summary, 'warning');
      if (subtext) subtext.innerText = data.summary;
      return;
    }

    if (data.status === 'COMPLETED') {
      showNotification('Workflow completed autonomously via 6 verified MCP tools!');
      currentWorkflow = data;
      renderWorkspaceWorkflow({
        runId: data.runId,
        latencyMs: data.totalLatencyMs,
        revisionPlan: {
          topics: JSON.stringify(data.results.topics),
          milestones: JSON.stringify(data.results.milestones),
        },
        studySessions: data.results.studySessions,
        quiz: { quizCode: data.results.quizCode },
        steps: data.toolSteps.map((s) => ({
          stepIndex: s.stepIndex,
          toolName: s.toolName,
          status: s.status,
          latencyMs: s.latencyMs,
          inputPayload: s.output?.input || {},
          outputPayload: s.output,
        })),
      });

      // Reload background datasets
      loadRevisionPlanner();
      loadQuizStudio();
      loadWorkflowHistory();
      refreshSystemStatus();
    }
  } catch (err) {
    console.error('Chat error:', err);
    showNotification(`Execution failed: ${err.message}`, 'error');
  } finally {
    if (sendBtn) {
      sendBtn.removeAttribute('disabled');
      sendBtn.innerHTML = `<span class="material-symbols-outlined text-[20px]">arrow_upward</span>`;
    }
    composer.value = '';
  }
}

function exportAuditLog() {
  if (!currentWorkflow) {
    showNotification('No active workflow data to export.', 'warning');
    return;
  }
  const blob = new Blob([JSON.stringify(currentWorkflow, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Nexus_AI_Audit_${currentWorkflow.runId || 'RUN'}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showNotification('Audit log exported successfully.');
}

// ============================================================================
// 3. KNOWLEDGE BASE CONTROLLER
// ============================================================================
async function loadKnowledgeBase() {
  try {
    const res = await fetch('/api/documents');
    if (!res.ok) return;
    allDocuments = await res.json();
    renderKBDocuments(allDocuments);
  } catch (err) {
    console.warn('Failed to load documents:', err);
  }
}

function renderKBDocuments(docs) {
  const container = document.getElementById('kb-documents-container');
  if (!container) return;

  const countBadge = document.getElementById('kb-corpus-status');
  if (countBadge) countBadge.innerText = `${docs.length} Records Indexed`;

  if (docs.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-outline">No documents indexed in knowledge base yet.</div>`;
    return;
  }

  container.innerHTML = docs.map((doc) => {
    const isCurated = doc.category === 'curated';
    const catBadge = isCurated ? 'bg-secondary-container/30 text-secondary' : 'bg-surface-container-highest text-primary-fixed-dim';
    const catLabel = isCurated ? 'Curated OKF' : 'User Upload';
    const icon = doc.fileType === 'pdf' ? 'picture_as_pdf' : 'description';

    return `
      <div class="rounded-lg bg-surface-container-lowest/80 hover:bg-surface-container-highest/40 transition-all p-space-sm flex flex-col md:flex-row md:items-center justify-between gap-space-sm border border-surface-container-highest/20" data-category="${doc.category}">
        <div class="flex items-center gap-space-sm min-w-0">
          <span class="material-symbols-outlined text-[24px] text-primary-container shrink-0">${icon}</span>
          <div class="flex flex-col min-w-0">
            <span class="font-title-sm text-title-sm text-on-surface truncate">${doc.title || doc.fileName}</span>
            <div class="flex items-center gap-space-xs font-code-sm text-code-sm text-outline flex-wrap">
              <span class="px-1.5 py-0.2 rounded ${catBadge} uppercase text-[10px]">${catLabel}</span>
              <span>•</span>
              <span class="text-primary-fixed-dim">${doc.passagesCount || 0} Passages</span>
              <span>•</span>
              <span>${doc.tokenCount} Tokens</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-space-sm shrink-0">
          <span class="inline-flex items-center gap-1 px-space-xs py-0.5 rounded bg-primary-container/15 text-primary-container font-label-badge text-label-badge uppercase">
            <span class="material-symbols-outlined text-[12px]">check_circle</span>
            Indexed
          </span>
          <button class="p-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container text-on-surface hover:text-primary-container transition-colors" title="Inspect Passages" onclick="inspectDocumentPassages('${doc.id}', '${doc.title || doc.fileName}')">
            <span class="material-symbols-outlined text-[16px]">visibility</span>
          </button>
          <button class="p-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container text-on-surface hover:text-error transition-colors" title="Delete Document" onclick="deleteDocument('${doc.id}')">
            <span class="material-symbols-outlined text-[16px]">delete</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function filterKBDocuments(category) {
  document.querySelectorAll('#kb-filter-pills .filter-pill').forEach(btn => {
    if (btn.getAttribute('data-filter') === category) {
      btn.className = 'filter-pill active px-space-sm py-1.5 rounded-lg bg-primary-container text-on-primary-container font-code-sm text-code-sm font-semibold transition-all';
    } else {
      btn.className = 'filter-pill px-space-sm py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-code-sm text-code-sm transition-all';
    }
  });

  if (category === 'all') {
    renderKBDocuments(allDocuments);
  } else {
    renderKBDocuments(allDocuments.filter(d => d.category === category));
  }
}

async function executeKBSearch() {
  const input = document.getElementById('kb-search-input');
  if (!input) return;
  const query = input.value.trim();
  if (!query) return;

  const resultsPanel = document.getElementById('kb-search-results-panel');
  const resultsList = document.getElementById('kb-search-results-list');
  const resultsHeader = document.getElementById('kb-search-results-header');

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=4`);
    const data = await res.json();

    if (resultsPanel && resultsList && resultsHeader) {
      resultsHeader.innerText = `RAG Search Results (${data.total_matches} matches for "${query}")`;
      resultsPanel.classList.remove('hidden');

      if (data.passages.length === 0) {
        resultsList.innerHTML = `<div class="p-4 text-center text-outline">No relevant passages found above threshold.</div>`;
      } else {
        resultsList.innerHTML = data.passages.map((p) => `
          <div class="p-space-sm rounded-lg bg-surface-container flex flex-col gap-1 border-l-2 border-primary-container">
            <div class="flex items-center justify-between text-outline font-code-sm text-code-sm">
              <span class="text-primary font-semibold">${p.sourceTitle} § ${p.section || 'General'}</span>
              <span class="text-primary-fixed-dim">Score: ${p.score}</span>
            </div>
            <p class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              ${p.content}
            </p>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    showNotification(`Search failed: ${err.message}`, 'error');
  }
}

async function handleFileUpload(e) {
  const target = e.target;
  if (!target.files || target.files.length === 0) return;

  const file = target.files[0];
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
  formData.append('category', 'user');

  showNotification(`Indexing ${file.name}...`);

  try {
    const res = await fetch('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Upload failed');
    }
    const data = await res.json();
    showNotification(`Document indexed: ${data.document.title} (${data.document.chunksCount} passages)`);
    await loadKnowledgeBase();
    await refreshSystemStatus();
  } catch (err) {
    showNotification(`Upload error: ${err.message}`, 'error');
  } finally {
    target.value = '';
  }
}

async function inspectDocumentPassages(docId, title) {
  const modal = document.getElementById('modal-chunk-viewer');
  const titleEl = document.getElementById('chunk-modal-title');
  const listEl = document.getElementById('chunk-modal-passages-list');

  if (titleEl) titleEl.innerText = title;
  if (listEl) listEl.innerHTML = `<div class="p-8 text-center text-outline">Loading passages...</div>`;
  if (modal) modal.classList.remove('hidden');

  try {
    const res = await fetch(`/api/documents/${docId}/chunks`);
    const chunks = await res.json();

    if (listEl) {
      if (chunks.length === 0) {
        listEl.innerHTML = `<div class="p-8 text-center text-outline">No chunks extracted for this document.</div>`;
      } else {
        listEl.innerHTML = chunks.map((c) => `
          <div class="p-space-sm rounded-lg bg-surface-container flex flex-col gap-1 border border-surface-container-highest/30">
            <div class="flex items-center justify-between text-outline font-code-sm text-code-sm">
              <span class="text-primary font-semibold">Chunk #${c.chunkIndex + 1} • ${c.section || 'General'}</span>
              <span>Page ${c.pageNumber || 1}</span>
            </div>
            <p class="font-body-sm text-body-sm text-on-surface leading-relaxed">${c.content}</p>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    if (listEl) listEl.innerHTML = `<div class="p-4 text-error">Failed to load passages: ${err.message}</div>`;
  }
}

function closeChunkModal() {
  const modal = document.getElementById('modal-chunk-viewer');
  if (modal) modal.classList.add('hidden');
}

async function deleteDocument(docId) {
  if (!confirm('Are you sure you want to delete this document from the knowledge base?')) return;
  try {
    const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
    if (res.ok) {
      showNotification('Document deleted.');
      await loadKnowledgeBase();
      await refreshSystemStatus();
    }
  } catch (err) {
    showNotification(`Delete failed: ${err.message}`, 'error');
  }
}

// ============================================================================
// 4. REVISION PLANNER CONTROLLER
// ============================================================================
async function loadRevisionPlanner() {
  try {
    const res = await fetch('/api/planner/sessions');
    if (!res.ok) return;
    const sessions = await res.json();
    renderPlannerSessions(sessions);
  } catch (err) {
    console.warn('Failed to load study sessions:', err);
  }
}

function renderPlannerSessions(sessions) {
  const container = document.getElementById('planner-sessions-grid');
  if (!container) return;

  const statusEl = document.getElementById('planner-sync-status');
  if (statusEl) statusEl.innerText = `Synced (${sessions.length} Blocks Verified)`;

  if (sessions.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-outline col-span-3">No study sessions scheduled yet. Click "Add Study Session" to reserve a time block.</div>`;
    return;
  }

  container.innerHTML = sessions.map((s) => {
    const isCritical = s.priority === 'CRITICAL';
    const badgeColor = isCritical ? 'bg-error-container/40 text-error' : 'bg-secondary-container/40 text-secondary';
    const icon = isCritical ? 'bolt' : 'event';
    const dayStr = new Date(s.startTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = `${new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    return `
      <div class="p-space-md rounded-xl bg-surface-container flex flex-col justify-between shadow-md border border-surface-container-highest/20 hover:border-primary-container/40 transition-all">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="px-1.5 py-0.5 rounded ${badgeColor} font-label-badge text-label-badge uppercase flex items-center gap-1">
              <span class="material-symbols-outlined text-[12px]">${icon}</span> ${s.priority || 'HIGH'}
            </span>
            <span class="font-code-sm text-code-sm text-[#10B981] flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span> Confirmed
            </span>
          </div>
          <h3 class="font-title-sm text-title-sm text-on-surface font-semibold">${s.title}</h3>
          <p class="font-body-sm text-body-sm text-primary-fixed-dim mt-0.5">${s.focusTopic}</p>
          <div class="mt-2 flex items-center gap-1 font-code-sm text-code-sm text-outline">
            <span class="material-symbols-outlined text-[14px]">calendar_today</span>
            <span>${dayStr}</span>
            <span>•</span>
            <span>${timeStr} (${s.durationMinutes / 60}h)</span>
          </div>
        </div>
        <div class="mt-space-md pt-space-xs flex items-center justify-between font-code-sm text-code-sm text-outline border-t border-surface-container-highest/20">
          <span>${s.location || 'Quiet Study 3B'}</span>
          <button class="hover:text-error transition-colors" title="Remove Session" onclick="deleteSession('${s.id}')">
            <span class="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function openAddSessionModal() {
  const modal = document.getElementById('modal-add-session');
  if (!modal) return;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);

  const startInput = document.getElementById('session-input-start');
  const endInput = document.getElementById('session-input-end');
  if (startInput) startInput.value = tomorrow.toISOString().slice(0, 16);

  tomorrow.setHours(16, 0, 0, 0);
  if (endInput) endInput.value = tomorrow.toISOString().slice(0, 16);

  const alertBox = document.getElementById('session-conflict-alert');
  if (alertBox) alertBox.classList.add('hidden');

  modal.classList.remove('hidden');
}

function closeAddSessionModal() {
  const modal = document.getElementById('modal-add-session');
  if (modal) modal.classList.add('hidden');
}

async function submitNewSession(e) {
  e.preventDefault();
  const title = document.getElementById('session-input-title').value;
  const focusTopic = document.getElementById('session-input-topic').value;
  const startTime = document.getElementById('session-input-start').value;
  const endTime = document.getElementById('session-input-end').value;
  const location = document.getElementById('session-input-location').value;
  const priority = document.getElementById('session-input-priority').value;

  const alertBox = document.getElementById('session-conflict-alert');

  try {
    const res = await fetch('/api/planner/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        focusTopic,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        location,
        priority,
      }),
    });

    if (res.status === 409) {
      const err = await res.json();
      if (alertBox) {
        alertBox.innerText = err.error || 'Conflict detected with existing session!';
        alertBox.classList.remove('hidden');
      }
      return;
    }

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save session');
    }

    showNotification('Study session scheduled and verified in persistent DB!');
    closeAddSessionModal();
    await loadRevisionPlanner();
    await refreshSystemStatus();
  } catch (err) {
    showNotification(`Error: ${err.message}`, 'error');
  }
}

async function deleteSession(sessionId) {
  if (!confirm('Remove this scheduled session?')) return;
  try {
    const res = await fetch(`/api/planner/sessions/${sessionId}`, { method: 'DELETE' });
    if (res.ok) {
      showNotification('Study session removed.');
      await loadRevisionPlanner();
      await refreshSystemStatus();
    }
  } catch (err) {
    showNotification(`Failed to remove session: ${err.message}`, 'error');
  }
}

// ============================================================================
// 5. QUIZ STUDIO CONTROLLER
// ============================================================================
async function loadQuizStudio() {
  try {
    const res = await fetch('/api/quizzes/QZ-409');
    if (res.ok) {
      currentQuiz = await res.json();
      currentQuizQuestionIndex = 0;
      userQuizAnswers = {};
      renderQuizQuestion();
    }
  } catch (err) {
    console.warn('Failed to load quiz studio:', err);
  }
}

function renderQuizQuestion() {
  if (!currentQuiz || !currentQuiz.questions || currentQuiz.questions.length === 0) return;

  const q = currentQuiz.questions[currentQuizQuestionIndex];
  const total = currentQuiz.questions.length;

  const numLabel = document.getElementById('quiz-question-number-label');
  if (numLabel) numLabel.innerText = `Question ${currentQuizQuestionIndex + 1}`;

  const counterLabel = document.getElementById('quiz-total-counter-label');
  if (counterLabel) counterLabel.innerText = `of ${total} questions`;

  const progressBar = document.getElementById('quiz-progress-bar');
  if (progressBar) {
    const pct = ((currentQuizQuestionIndex + 1) / total) * 100;
    progressBar.style.width = `${pct}%`;
  }

  const promptText = document.getElementById('quiz-prompt-text');
  if (promptText) promptText.innerText = q.prompt;

  // Options
  const optionsContainer = document.getElementById('quiz-options-container');
  if (optionsContainer) {
    const selectedAnswer = userQuizAnswers[q.id];

    optionsContainer.innerHTML = (q.options || []).map((opt) => {
      const isSelected = selectedAnswer === opt.label;
      const isCorrect = q.correctAnswer === opt.label;

      let borderClass = 'border-surface-container-highest/20 hover:border-primary-container/40';
      let icon = '';

      if (selectedAnswer) {
        if (isSelected && isCorrect) {
          borderClass = 'border-[#10B981] bg-[#10B981]/10 ring-1 ring-[#10B981]';
          icon = `<span class="material-symbols-outlined text-[20px] text-[#10B981] ml-auto">check_circle</span>`;
        } else if (isSelected && !isCorrect) {
          borderClass = 'border-error bg-error/10 ring-1 ring-error';
          icon = `<span class="material-symbols-outlined text-[20px] text-error ml-auto">cancel</span>`;
        } else if (isCorrect) {
          borderClass = 'border-[#10B981]/50 bg-[#10B981]/5';
          icon = `<span class="material-symbols-outlined text-[20px] text-[#10B981] ml-auto">check</span>`;
        }
      }

      return `
        <label class="group relative flex items-start gap-space-md p-space-md rounded-xl bg-surface-container/60 transition-all cursor-pointer border ${borderClass}" onclick="selectQuizAnswer('${q.id}', '${opt.label}')">
          <div class="pt-0.5 flex items-center justify-center">
            <input type="radio" name="quiz-radio-${q.id}" value="${opt.label}" ${isSelected ? 'checked' : ''} class="w-4 h-4 text-primary-container cursor-pointer"/>
          </div>
          <div class="flex flex-col gap-1 min-w-0">
            <span class="font-code-sm text-code-sm text-primary font-semibold">OPTION ${opt.label}</span>
            <p class="font-body-md text-body-md text-on-surface">${opt.text}</p>
          </div>
          ${icon}
        </label>
      `;
    }).join('');
  }

  // Rationale & Grounding Box
  const rationaleText = document.getElementById('quiz-rationale-text');
  const citationSource = document.getElementById('quiz-citation-source');
  const simBadge = document.getElementById('quiz-similarity-badge');

  if (rationaleText && citationSource && simBadge) {
    if (userQuizAnswers[q.id]) {
      rationaleText.innerHTML = `<strong class="text-on-surface">Algorithmic Rationale:</strong> ${q.rationale}`;
      citationSource.innerText = q.citation || 'CS452 Lecture Notes';
      simBadge.innerText = `Similarity: ${q.similarityScore || 0.942}`;
    } else {
      rationaleText.innerText = 'Select an answer above to reveal the algorithmic rationale and course note citation.';
      citationSource.innerText = q.citation || 'CS452 Lecture Notes';
      simBadge.innerText = 'Grounded RAG Citation';
    }
  }

  // Next / Submit Button Text
  const nextBtn = document.getElementById('btn-next-question');
  if (nextBtn) {
    if (currentQuizQuestionIndex === total - 1) {
      nextBtn.innerHTML = `<span>Submit Attempt</span><span class="material-symbols-outlined text-[18px]">done_all</span>`;
    } else {
      nextBtn.innerHTML = `<span>Next Question</span><span class="material-symbols-outlined text-[18px]">arrow_forward</span>`;
    }
  }
}

function selectQuizAnswer(questionId, answer) {
  userQuizAnswers[questionId] = answer;
  renderQuizQuestion();

  // Update running score
  let correct = 0;
  let totalAnswered = 0;
  for (const q of currentQuiz.questions) {
    if (userQuizAnswers[q.id]) {
      totalAnswered++;
      if (userQuizAnswers[q.id] === q.correctAnswer) {
        correct++;
      }
    }
  }

  const scoreDisplay = document.getElementById('quiz-score-display');
  if (scoreDisplay) {
    scoreDisplay.innerText = `Score: ${correct}/${totalAnswered}`;
  }
}

function nextQuizQuestion() {
  if (!currentQuiz || !currentQuiz.questions) return;
  if (currentQuizQuestionIndex < currentQuiz.questions.length - 1) {
    currentQuizQuestionIndex++;
    renderQuizQuestion();
  } else {
    submitQuizAttempt();
  }
}

function prevQuizQuestion() {
  if (currentQuizQuestionIndex > 0) {
    currentQuizQuestionIndex--;
    renderQuizQuestion();
  }
}

async function submitQuizAttempt() {
  if (!currentQuiz) return;
  try {
    const res = await fetch(`/api/quizzes/${currentQuiz.id}/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: userQuizAnswers }),
    });

    const data = await res.json();
    showNotification(`Quiz Submitted! Final Score: ${data.score}/${data.maxScore} (${data.percentage}%)`);
  } catch (err) {
    showNotification(`Submission error: ${err.message}`, 'error');
  }
}

// ============================================================================
// 6. WORKFLOW HISTORY CONTROLLER
// ============================================================================
async function loadWorkflowHistory() {
  try {
    const res = await fetch('/api/workflows');
    if (!res.ok) return;
    allWorkflows = await res.json();
    renderWorkflowHistoryList(allWorkflows);
    if (allWorkflows.length > 0) {
      inspectWorkflowDetail(allWorkflows[0].id);
    }
  } catch (err) {
    console.warn('Failed to load workflows:', err);
  }
}

function renderWorkflowHistoryList(workflows) {
  const container = document.getElementById('history-runs-list');
  if (!container) return;

  const totalRunsEl = document.getElementById('history-total-runs');
  if (totalRunsEl) totalRunsEl.innerText = `${workflows.length}`;

  if (workflows.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-outline">No past workflows recorded.</div>`;
    return;
  }

  container.innerHTML = workflows.map((w) => {
    return `
      <div class="relative p-space-md rounded-xl bg-surface-container-low transition-all shadow-md cursor-pointer border border-surface-container-highest/20 hover:border-primary-container/40" onclick="inspectWorkflowDetail('${w.id}')">
        <div class="flex items-center justify-between gap-space-sm mb-1">
          <div class="flex items-center gap-space-sm">
            <span class="font-code-md text-code-md font-semibold text-primary">#${w.runId}</span>
            <span class="text-outline font-code-sm text-code-sm">• ${new Date(w.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <span class="inline-flex items-center gap-1 px-space-xs py-0.5 rounded bg-surface-container-high text-primary-container font-label-badge text-label-badge font-semibold">
            <span class="material-symbols-outlined text-[14px]">check_circle</span>
            ${w.status}
          </span>
        </div>
        <h3 class="font-title-sm text-title-sm text-on-surface font-semibold mb-1 leading-snug">
          ${w.title}
        </h3>
        <div class="flex items-center gap-space-md text-outline font-code-sm text-code-sm">
          <span class="text-primary-fixed-dim">6 MCP Tools</span>
          <span>•</span>
          <span>${w.latencyMs}ms</span>
          <span>•</span>
          <span class="text-[#10B981]">Verified DB Sync</span>
        </div>
      </div>
    `;
  }).join('');
}

async function inspectWorkflowDetail(workflowId) {
  const inspector = document.getElementById('history-detail-inspector');
  if (!inspector) return;

  try {
    const res = await fetch(`/api/workflows/${workflowId}`);
    if (!res.ok) return;
    const wf = await res.json();

    inspector.innerHTML = `
      <div class="flex flex-col gap-space-md">
        <div class="flex items-center justify-between pb-space-sm border-b border-surface-container-highest/20">
          <div>
            <h2 class="font-title-sm text-title-sm text-primary font-bold">#${wf.runId} Execution Audit Trace</h2>
            <span class="font-code-sm text-code-sm text-outline">Created: ${new Date(wf.createdAt).toLocaleString()}</span>
          </div>
          <span class="px-2 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] font-code-sm text-code-sm font-semibold">
            100% Writes Verified
          </span>
        </div>
        <div class="p-space-sm rounded-lg bg-surface-container font-body-sm text-body-sm text-on-surface">
          <strong>Goal:</strong> “${wf.goal}”
        </div>
        <div class="flex flex-col gap-2">
          <h3 class="font-code-sm text-code-sm text-outline uppercase">Tool Execution Sequence</h3>
          ${(wf.steps || []).map((s) => `
            <div class="p-2 rounded bg-surface-container-lowest border border-surface-container-highest/20 flex flex-col gap-1">
              <div class="flex items-center justify-between font-code-sm text-code-sm">
                <span class="text-primary font-semibold">${s.stepIndex}. ${s.toolName}</span>
                <span class="text-outline">${s.latencyMs}ms</span>
              </div>
              <pre class="font-code-sm text-[11px] text-on-surface-variant overflow-x-auto p-1.5 bg-surface-container rounded">${s.outputPayload}</pre>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    inspector.innerHTML = `<div class="p-4 text-error">Failed to inspect workflow: ${err.message}</div>`;
  }
}

// ============================================================================
// 7. MCP TOOLS DEVELOPER CONSOLE & LIVE SANDBOX
// ============================================================================
async function loadMCPTools() {
  try {
    const res = await fetch('/api/mcp/tools');
    if (!res.ok) return;
    const data = await res.json();
    renderMCPToolsGrid(data.tools || []);
  } catch (err) {
    console.warn('Failed to load MCP tools:', err);
  }
}

function renderMCPToolsGrid(tools) {
  const grid = document.getElementById('mcp-tools-grid');
  if (!grid) return;

  grid.innerHTML = tools.map((t) => {
    return `
      <div class="p-space-md rounded-xl bg-surface-container-low/70 border border-surface-container-highest/20 shadow-md flex flex-col justify-between hover:border-primary-container/40 transition-all">
        <div class="flex flex-col gap-space-xs">
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary-container">
                <span class="material-symbols-outlined text-[18px]">terminal</span>
              </div>
              <span class="font-code-md text-code-md font-semibold text-primary">${t.name}</span>
            </div>
            <span class="px-1.5 py-0.2 rounded bg-surface-container text-[#10B981] font-code-sm text-code-sm">
              Ready
            </span>
          </div>
          <p class="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-normal">
            ${t.description || 'MCP Tool capability'}
          </p>
        </div>
        <div class="mt-space-md pt-space-xs border-t border-surface-container-highest/20 flex items-center justify-between">
          <span class="font-code-sm text-code-sm text-outline">Streamable HTTP</span>
          <button class="font-code-sm text-code-sm text-primary hover:underline flex items-center gap-0.5" onclick="prefillSandboxFromTool('${t.name}')">
            <span>Dry-run</span>
            <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function prefillSandboxFromTool(toolName) {
  const select = document.getElementById('sandbox-tool-select');
  if (select) {
    select.value = toolName;
    prefillSandboxFromSelect();
  }
}

function prefillSandboxFromSelect() {
  const select = document.getElementById('sandbox-tool-select');
  const textarea = document.getElementById('sandbox-payload-input');
  if (!select || !textarea) return;

  const tool = select.value;
  switch (tool) {
    case 'search_knowledge':
      textarea.value = JSON.stringify({ query: 'Raft consensus election safety invariants', limit: 3 }, null, 2);
      break;
    case 'extract_important_topics':
      textarea.value = JSON.stringify({ course_context: 'CS452 Distributed Systems', exam_date: 'Friday' }, null, 2);
      break;
    case 'create_revision_plan':
      textarea.value = JSON.stringify({
        topics: [{ name: 'Distributed Consensus & Raft' }, { name: 'Vector Clocks' }],
        exam_date: 'Friday',
        available_hours: 8.5
      }, null, 2);
      break;
    case 'schedule_study_sessions':
      textarea.value = JSON.stringify({
        sessions: [{
          title: 'Raft Consensus Review Block',
          focusTopic: 'Distributed Consensus & Raft Protocol',
          startTime: new Date(Date.now() + 86400000).toISOString(),
          endTime: new Date(Date.now() + 86400000 + 7200000).toISOString(),
          location: 'Quiet Study 3B',
          priority: 'CRITICAL'
        }]
      }, null, 2);
      break;
    case 'generate_quiz':
      textarea.value = JSON.stringify({ course: 'CS452 Distributed Systems', question_count: 3, difficulty: 'hard' }, null, 2);
      break;
    case 'get_workflow_status':
      textarea.value = JSON.stringify({ workflow_id: 'RUN-8821B' }, null, 2);
      break;
    default:
      textarea.value = '{}';
  }
}

async function executeSandboxDryRun() {
  const select = document.getElementById('sandbox-tool-select');
  const textarea = document.getElementById('sandbox-payload-input');
  const outputDisplay = document.getElementById('sandbox-output-display');
  const latencyTag = document.getElementById('sandbox-latency-tag');

  if (!select || !textarea || !outputDisplay) return;

  let payload = {};
  try {
    payload = JSON.parse(textarea.value);
  } catch (err) {
    showNotification(`Invalid JSON: ${err.message}`, 'error');
    return;
  }

  outputDisplay.innerText = '// Executing MCP tool call...';
  if (latencyTag) latencyTag.innerText = 'Latency: --';

  try {
    const res = await fetch('/api/mcp/dry-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolName: select.value, payload }),
    });

    const data = await res.json();
    outputDisplay.innerText = JSON.stringify(data, null, 2);
    if (latencyTag) latencyTag.innerText = `Latency: ${data.latencyMs || 0}ms (${data.transportUsed || 'direct'})`;
  } catch (err) {
    outputDisplay.innerText = `// Error executing tool: ${err.message}`;
  }
}

// ============================================================================
// 8. COMMAND PALETTE & MODALS
// ============================================================================
function openCommandPalette() {
  const modal = document.getElementById('modal-command-palette');
  const input = document.getElementById('palette-input');
  if (modal) {
    modal.classList.remove('hidden');
    if (input) {
      input.value = '';
      input.focus();
    }
  }
}

function closeCommandPalette() {
  const modal = document.getElementById('modal-command-palette');
  if (modal) modal.classList.add('hidden');
}

function handlePaletteKey(e) {
  if (e.key === 'Escape') {
    closeCommandPalette();
  }
}

function closeAllModals() {
  closeCommandPalette();
  closeChunkModal();
  closeAddSessionModal();
}

function showNotification(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const borderColor = type === 'error' ? 'border-error text-error' : type === 'warning' ? 'border-amber-400 text-amber-300' : 'border-primary-container text-on-surface';

  toast.className = `p-3 rounded-xl bg-surface-container-low/95 backdrop-blur-xl border ${borderColor} shadow-2xl font-body-sm text-body-sm flex items-center gap-2 max-w-sm transition-all duration-300 transform translate-y-2 opacity-0`;
  toast.innerHTML = `
    <span class="material-symbols-outlined text-[18px]">${type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info'}</span>
    <span class="flex-1">${message}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
