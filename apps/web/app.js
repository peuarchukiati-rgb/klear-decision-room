let selectedCaseId = null;
let currentStory = null;
let demoIntakePackets = [];
let liveModelCredentials = {
  api_key: ""
};
let currentBriefMarkdown = "";
let currentHandoffMarkdown = "";
let demoRunnerPinned = false;
let curatedHeroCaseId = null;
let introActive = false;
const INTRO_DISMISSED_KEY = "klear-demo-intro-v1";
const PROOF_STEP_LABELS = ["Intake received", "Truth verified", "Grounded brief prepared", "Unsafe approval blocked", "Human decision recorded", "Handoff acknowledged, evidence pending"];

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Request failed");
  }
  return body;
}

function moneyFromCase(decisionCase) {
  const fact = decisionCase.facts.find((item) => item.field === "total");
  if (fact) return `${fact.value}`;
  const invoice = decisionCase.input_records.find((item) => item.source_type === "INVOICE");
  return invoice?.payload?.total ? `${invoice.payload.total}` : "Unknown";
}

function factFromCase(decisionCase, field) {
  return decisionCase.facts.find((item) => item.field === field)?.value;
}

function formatMoney(decisionCase) {
  const amount = Number(moneyFromCase(decisionCase));
  const currency = factFromCase(decisionCase, "currency") || "USD";
  if (!Number.isFinite(amount)) return "Amount unknown";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-US")}`;
  }
}

function formatStatus(status = "") {
  return status.toLowerCase().split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function formatTime(timestamp) {
  if (!timestamp) return "Unknown time";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function vendorFromCase(decisionCase) {
  const fact = decisionCase.facts.find((item) => item.field === "vendor_name");
  if (fact?.value && String(fact.value).trim()) return fact.value;
  const invoiceName = decisionCase.input_records.find((item) => item.source_type === "INVOICE")?.payload?.vendor_name;
  return invoiceName && String(invoiceName).trim() ? invoiceName : "Unnamed vendor (see intake)";
}

function severityFromCase(decisionCase) {
  const fail = decisionCase.rule_results.filter((rule) => rule.status === "FAIL").length;
  const unknown = decisionCase.rule_results.filter((rule) => rule.status === "UNKNOWN").length;
  if (fail || unknown) return "Attention";
  if (decisionCase.rule_results.some((rule) => rule.status === "WARNING")) return "Review";
  return "Normal";
}

function el(id) {
  return document.getElementById(id);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pill(text, ready) {
  return `<span class="pill ${ready ? "ready" : "blocked"}">${text}</span>`;
}

function renderRows(items, render) {
  return items.length ? items.map((item) => `<div class="row">${render(item)}</div>`).join("") : "<p class=\"meta\">None recorded.</p>";
}

function switchTab(tabName) {
  document.querySelectorAll(".tabs button").forEach((item) => item.classList.toggle("active", item.dataset.tab === tabName));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.hidden = panel.id !== `tab-${tabName}`);
}

function revealDemoStage() {
  el("demo-stage").hidden = false;
}

function initializeIntro() {
  if (sessionStorage.getItem(INTRO_DISMISSED_KEY)) return;
  introActive = true;
  el("intro-overlay").hidden = false;
  document.body.classList.add("intro-open");
}

function dismissIntro({ pulse = true } = {}) {
  sessionStorage.setItem(INTRO_DISMISSED_KEY, "dismissed");
  introActive = false;
  el("intro-overlay").hidden = true;
  document.body.classList.remove("intro-open");
  demoRunnerPinned = true;
  el("demo-runner").hidden = false;
  el("show-demo").classList.toggle("demo-cta-pulse", pulse);
}

function artifactCopy(name, content) {
  return navigator.clipboard.writeText(content).then(() => {
    el("artifact-subtitle").textContent = `${name} copied to clipboard.`;
  });
}

function downloadText(filename, content, type = "text/markdown") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function openArtifact(type) {
  if (!selectedCaseId || !currentStory) return;
  const labels = {
    brief: ["Case writing artifact", "Grounded Case Brief", "Prepared from persisted facts, evidence, and rule results."],
    handoff: ["State transfer artifact", "Decision Handoff", "Portable context for the next owner, agent, or system."],
    packback: ["Return artifact", "Pack Back", "Bring completed work back into the versioned DecisionCase."]
  };
  document.querySelectorAll(".artifact-view").forEach((view) => view.hidden = view.id !== `artifact-${type}`);
  el("artifact-kicker").textContent = labels[type][0];
  el("artifact-title").textContent = labels[type][1];
  el("artifact-subtitle").textContent = labels[type][2];
  const dialog = el("artifact-dialog");
  if (!dialog.open) dialog.showModal();
}

function selectedPacket() {
  const packetId = el("packet-select").value;
  return demoIntakePackets.find((item) => item.packet_id === packetId);
}

async function loadDemoIntakePackets() {
  const { packets } = await api("/demo-intake-packets");
  demoIntakePackets = packets;
  el("packet-select").innerHTML = packets.map((item) => `
    <option value="${item.packet_id}">${item.kind.toUpperCase()} · ${item.scenario_id}</option>
  `).join("");
  if (packets.some((item) => item.packet_id === "DEMO-HANDOFF-SCN-BANK-MISMATCH")) {
    el("packet-select").value = "DEMO-HANDOFF-SCN-BANK-MISMATCH";
  }
  renderSelectedPacket();
}

function renderSelectedPacket() {
  const item = selectedPacket();
  el("packet-preview").textContent = item ? JSON.stringify(item.packet, null, 2) : "No demo intake packets available.";
}

function findDemoPacket(packetId) {
  const item = demoIntakePackets.find((packet) => packet.packet_id === packetId);
  if (!item) {
    throw new Error(`Demo packet unavailable: ${packetId}`);
  }
  return item;
}

function writeRunway(lines) {
  revealDemoStage();
  el("runway-result").textContent = Array.isArray(lines) ? lines.join("\n") : lines;
}

function setRunwayBusy(isBusy, mode = "") {
  for (const id of ["show-demo", "start-live-demo", "run-offline-demo", "compare-intakes", "import-packet", "run-review", "run-brief", "try-blocked-approve", "request-evidence", "import-demo-packback"]) {
    const button = el(id);
    if (button) button.disabled = isBusy;
  }
  const liveSubmit = el("case-brief-form")?.querySelector("button[type='submit']");
  if (liveSubmit) liveSubmit.disabled = isBusy;

  document.querySelectorAll(".is-busy").forEach((button) => button.classList.remove("is-busy"));
  const busyButtons = mode === "live"
    ? [liveSubmit]
    : mode === "offline"
      ? [el("show-demo"), el("start-live-demo"), el("run-offline-demo")]
      : [];
  if (isBusy) {
    busyButtons.filter(Boolean).forEach((button) => button.classList.add("is-busy"));
  }
  el("start-live-demo").textContent = isBusy && mode === "offline" ? "Running offline check..." : "Run Bank-Mismatch Demo";
  el("run-offline-demo").textContent = isBusy && mode === "offline" ? "Running offline check..." : "Run Offline Demo";
  if (liveSubmit) liveSubmit.textContent = isBusy && mode === "live" ? "Running live review..." : "Connect & Run Live";
}

function markProofStep(index, state = "done") {
  const steps = Array.from(document.querySelectorAll("#runway-steps .step"));
  if (steps[index]) {
    steps[index].classList.remove("active", "done", "blocked", "pending");
    steps[index].classList.add(state);
  }
}

function setRunwayActivity(text, state = "active") {
  const activity = el("runway-activity");
  activity.className = `runway-activity ${state}`;
  el("runway-activity-text").textContent = text;
}

function activateProofStep(index, label, activityText) {
  setProofStepLabel(index, label);
  markProofStep(index, "active");
  setRunwayActivity(activityText);
}

function failActiveProofStep() {
  const activeStep = document.querySelector("#runway-steps .step.active");
  if (activeStep) {
    activeStep.classList.remove("active");
    activeStep.classList.add("blocked");
  }
}

function setProofStepLabel(index, label) {
  const steps = Array.from(document.querySelectorAll("#runway-steps .step"));
  if (steps[index]) steps[index].textContent = label;
}

function clearProofSteps() {
  document.querySelectorAll("#runway-steps .step").forEach((step, index) => {
    step.classList.remove("active", "done", "blocked", "pending");
    step.textContent = PROOF_STEP_LABELS[index];
  });
}

function setModelConnectionState(state, detail, tone = "disconnected") {
  const lane = document.querySelector(".case-writer-lane");
  lane.classList.remove("disconnected", "connected", "connecting");
  lane.classList.add(tone);
  el("connection-state").textContent = state;
  el("connection-detail").textContent = detail;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function updateRunway(story = currentStory) {
  const decisionCase = story?.latest_handoff?.machine_readable;
  const steps = Array.from(document.querySelectorAll("#runway-steps .step"));
  const states = [
    Boolean(decisionCase),
    Boolean(decisionCase?.rule_results?.length),
    Boolean(decisionCase?.ai_case_brief?.summary),
    null,
    Boolean(decisionCase?.human_decision_events?.length),
    Boolean(decisionCase?.pack_back_events?.length)
  ];
  steps.forEach((step, index) => {
    if (states[index] !== null && !step.classList.contains("active")) {
      step.classList.toggle("done", states[index]);
    }
  });
  el("runway-status").textContent = decisionCase
    ? `${decisionCase.case_id} · ${decisionCase.status}`
    : "No intake imported";
}

async function importDemoPacket(packetId) {
  const item = findDemoPacket(packetId);
  const result = await api("/intake-packets", {
    method: "POST",
    body: JSON.stringify({ packet: item.packet })
  });
  selectedCaseId = result.case.case_id;
  await loadCases();
  await selectCase(selectedCaseId);
  return result.case;
}

async function runTruthReview(caseId) {
  return api(`/cases/${caseId}/deterministic-review`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

async function prepareLiveBrief(caseId, credentials) {
  return api(`/cases/${caseId}/case-brief`, {
    method: "POST",
    body: JSON.stringify(credentials)
  });
}

async function attemptApproval(caseId) {
  try {
    await api(`/cases/${caseId}/decisions`, {
      method: "POST",
      body: JSON.stringify({
        action: "APPROVE",
        reviewer: { role: "REVIEWER", name: "Guardrail Tester" },
        reason: "Intentional guardrail proof."
      })
    });
    return { blocked: false, message: "Unexpected: approval succeeded." };
  } catch (error) {
    return { blocked: true, message: error.message };
  }
}

async function requestEvidenceDecision(caseId) {
  return api(`/cases/${caseId}/decisions`, {
    method: "POST",
    body: JSON.stringify({
      action: "REQUEST_EVIDENCE",
      reviewer: { role: "REVIEWER", name: "Finance Reviewer" },
      reason: "Evidence is required before a payment decision can be made.",
      required_evidence: ["Confirm the vendor's bank account directly before this payment can proceed."]
    })
  });
}

async function importPackBackFromStory(story) {
  const machine = story.latest_handoff.machine_readable;
  return api(`/cases/${story.case_id}/pack-back`, {
    method: "POST",
    body: JSON.stringify({
      case_id: story.case_id,
      source_case_version: story.version,
      handoff_id: machine.handoff_id,
      responding_actor: { role: "NEXT_OWNER", name: "Accounts Payable" },
      event_type: "ACTION_COMPLETED",
      completed_actions: ["Reviewed decision handoff and acknowledged required evidence."],
      new_evidence: [],
      changed_fields: [],
      unresolved_items: ["Vendor bank confirmation still required before approval."],
      note: "AP received the handoff and will collect the requested evidence.",
      timestamp: new Date().toISOString()
    })
  });
}

async function loadCases({ selectFirst = true } = {}) {
  const { cases } = await api("/cases");
  const hasCases = cases.length > 0;
  curatedHeroCaseId = cases.find((decisionCase) => {
    const bankRule = decisionCase.rule_results.find((rule) => rule.rule_id === "R-003");
    return bankRule?.status === "FAIL";
  })?.case_id || null;
  el("demo-runner").hidden = hasCases && !demoRunnerPinned;
  el("case-count").textContent = `${cases.length}`;
  el("case-list").innerHTML = cases.map((decisionCase) => `
    <button class="case-card ${decisionCase.case_id === selectedCaseId ? "selected" : ""}" data-case-id="${decisionCase.case_id}">
      <strong>${decisionCase.case_id}</strong>
      <span class="case-vendor">${vendorFromCase(decisionCase)}</span>
      <span class="case-amount">${formatMoney(decisionCase)}</span>
      <span class="case-card-meta"><span>${formatStatus(decisionCase.status)}</span><span>${severityFromCase(decisionCase)}</span></span>
    </button>
  `).join("");
  document.querySelectorAll("[data-case-id]").forEach((button) => {
    button.addEventListener("click", () => selectCase(button.dataset.caseId));
  });
  if (selectFirst && !selectedCaseId && cases[0] && !introActive) {
    await selectCase(cases[0].case_id);
  }
}

async function resetWorkspaceView() {
  selectedCaseId = null;
  currentStory = null;
  demoRunnerPinned = true;
  el("case-view").hidden = true;
  el("empty-state").hidden = false;
  el("demo-runner").hidden = false;
  el("demo-stage").hidden = true;
  el("runway-status").textContent = "No intake imported";
  el("runway-result").textContent = "Run offline to verify truth, or connect OpenAI to complete the live decision lifecycle.";
  clearProofSteps();
  setRunwayActivity("Ready to run.", "idle");
  el("show-demo").classList.add("demo-cta-pulse");
  await loadCases({ selectFirst: false });
}

async function selectCase(caseId) {
  selectedCaseId = caseId;
  el("start-live-demo").classList.remove("demo-cta-pulse");
  el("show-demo").classList.remove("demo-cta-pulse");
  const { decision_story } = await api(`/cases/${caseId}/decision-story`);
  currentStory = decision_story;
  renderCase(decision_story);
  document.querySelectorAll("[data-case-id]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.caseId === caseId);
  });
}

function renderCase(story) {
  const decisionCase = story.latest_handoff.machine_readable;
  updateRunway(story);
  el("empty-state").hidden = true;
  el("case-view").hidden = false;
  const invoiceNumber = factFromCase(decisionCase, "invoice_number") || "Invoice pending";
  const owner = decisionCase.current_owner?.name || decisionCase.current_owner?.role || "Unassigned";
  const timelineEvents = story.timeline?.events || [];
  const latestTimestamp = decisionCase.updated_at || timelineEvents[timelineEvents.length - 1]?.timestamp;
  el("case-folder-id").textContent = decisionCase.case_id;
  el("case-title").textContent = vendorFromCase(decisionCase);
  el("case-subtitle").textContent = `${invoiceNumber} · ${formatMoney(decisionCase)} · Owner: ${owner} · Updated ${formatTime(latestTimestamp)}`;
  el("case-health-summary").textContent = `${story.readiness.blocking_rule_count} blocker${story.readiness.blocking_rule_count === 1 ? "" : "s"} · Evidence ${story.readiness.evidence_completeness_percent}% · Policy ${story.readiness.policy_coverage_percent}%`;
  el("case-status").textContent = formatStatus(decisionCase.status);
  el("case-status").className = `pill ${story.readiness.ready_for_decision ? "ready" : "blocked"}`;

  el("facts").innerHTML = decisionCase.facts.map((fact) => `<dt>${fact.field}</dt><dd>${fact.value}</dd>`).join("") || "<p class=\"meta\">No normalized facts yet.</p>";
  el("readiness").innerHTML = `
    ${pill(`Evidence ${story.readiness.evidence_completeness_percent}%`, story.readiness.evidence_completeness_percent === 100)}
    ${pill(`Policy ${story.readiness.policy_coverage_percent}%`, story.readiness.policy_coverage_percent === 100)}
    ${pill(`${story.readiness.unknown_count} unknown`, story.readiness.unknown_count === 0)}
    ${pill(`${story.readiness.blocking_rule_count} blockers`, story.readiness.blocking_rule_count === 0)}
    ${renderRows(story.readiness.readiness_reasons, (reason) => reason)}
  `;
  const aiBrief = decisionCase.ai_case_brief || {};
  if (aiBrief.writer_mode === "model") {
    el("authority-title").textContent = "OpenAI prepared this case.";
    el("authority-detail").textContent = "Only an explicit human action can decide it.";
  } else if (aiBrief.writer_mode === "fallback") {
    el("authority-title").textContent = "A deterministic fallback preview prepared this case.";
    el("authority-detail").textContent = "No model was called; only an explicit human action can decide it.";
  } else {
    el("authority-title").textContent = "OpenAI has not prepared this case.";
    el("authority-detail").textContent = "Truth is verified; connect OpenAI before the live decision journey continues.";
  }
  renderCaseWriterBadge(aiBrief);
  const briefText = [
    aiBrief.summary ? `Summary: ${aiBrief.summary}` : "No grounded case brief prepared yet.",
    aiBrief.risk_explanation ? `Risk: ${aiBrief.risk_explanation}` : "",
    aiBrief.recommended_disposition ? `Recommended disposition: ${aiBrief.recommended_disposition}` : "",
    aiBrief.missing_information_request ? `Missing information request: ${aiBrief.missing_information_request}` : ""
  ].filter(Boolean).join("\n\n");
  el("case-brief").textContent = briefText;
  renderBriefArtifact(decisionCase, aiBrief);
  renderPrimaryFinding(decisionCase);
  renderNextAction(story, decisionCase);
  renderDecisionSnapshot(decisionCase);
  el("rules").innerHTML = renderRows(decisionCase.rule_results, (rule) => `<strong>${rule.rule_id} ${rule.status}</strong><br>${rule.summary}<br><span class="meta">Evidence: ${(rule.evidence_ids || []).join(", ") || "None"}</span>`);
  el("unknowns").innerHTML = renderRows(decisionCase.unknowns, (item) => `${item.summary || item.field}<br><span class="meta">${item.evidence_unavailable_reason || ""}</span>`);
  renderTraceability(story.traceability);
  renderTimeline(story.timeline);
  renderHandoff(story.latest_handoff);
  seedPackBack(story);
}

function renderPrimaryFinding(decisionCase) {
  const result = decisionCase.rule_results.find((rule) => rule.status === "FAIL")
    || decisionCase.rule_results.find((rule) => rule.status === "UNKNOWN")
    || decisionCase.rule_results.find((rule) => rule.status === "WARNING");
  const status = el("primary-finding-status");
  if (result) {
    el("primary-finding").textContent = result.rule_name || result.rule_id;
    el("primary-finding-detail").textContent = result.summary;
    status.textContent = result.status;
    status.className = "finding-status";
    return;
  }
  if (decisionCase.rule_results.length) {
    el("primary-finding").textContent = "No blocking finding";
    el("primary-finding-detail").textContent = "Deterministic checks found no unresolved hard-gate rule in the current case version.";
    status.textContent = "Clear";
    status.className = "finding-status pass";
    return;
  }
  el("primary-finding").textContent = "Truth review not run";
  el("primary-finding-detail").textContent = "Normalize the intake and run deterministic checks before asking a human to decide.";
  status.textContent = "Pending";
  status.className = "finding-status";
}

function nextActionFor(story, decisionCase) {
  const latest = decisionCase.latest_decision_event;
  const requiredEvidence = latest?.required_evidence?.[0] || decisionCase.human_decision?.required_evidence?.[0];
  if (["APPROVED", "REJECTED", "CLOSED"].includes(decisionCase.status)) {
    return { title: "Review the completed decision record", detail: "This case is terminal. Its authority and lineage remain available in immutable history.", label: "Open history", action: "timeline" };
  }
  if (latest?.action === "REQUEST_EVIDENCE") {
    return { title: "Collect the requested evidence", detail: requiredEvidence || "The payment remains blocked until the requested evidence returns.", label: "Open handoff", action: "handoff" };
  }
  if (latest?.action === "ESCALATE") {
    return { title: "Follow the escalation", detail: `The case is waiting on ${latest.escalation_target?.name || "the next owner"}.`, label: "Open handoff", action: "handoff" };
  }
  if (!decisionCase.rule_results.length) {
    return { title: "Verify the intake", detail: "Run deterministic review to establish facts, evidence, and unknowns before a decision.", label: "Run truth review", action: "review" };
  }
  if (!story.readiness.ready_for_decision) {
    return { title: "Resolve the blocking finding", detail: story.readiness.readiness_reasons[0] || "Inspect the evidence behind the current blocker.", label: "Inspect evidence", action: "evidence" };
  }
  return { title: "Make the human decision", detail: "The case is decision-ready. Review the prepared context, then record an explicit human action.", label: "Decide", action: "decision" };
}

function renderNextAction(story, decisionCase) {
  const next = nextActionFor(story, decisionCase);
  el("next-action-title").textContent = next.title;
  el("next-action-detail").textContent = next.detail;
  el("next-action-button").textContent = next.label;
  el("next-action-button").dataset.action = next.action;
}

function renderDecisionSnapshot(decisionCase) {
  const event = decisionCase.latest_decision_event;
  if (!event) {
    el("decision-snapshot").innerHTML = "<span class=\"meta\">No human decision has been recorded.</span>";
    return;
  }
  el("decision-snapshot").innerHTML = `
    <strong>${formatStatus(event.action)}</strong><br>
    ${event.reason}<br>
    <span class="meta">${event.reviewer?.name || event.reviewer?.role || "Unknown reviewer"} · ${formatTime(event.decided_at)}</span>
  `;
}

function renderBriefArtifact(decisionCase, aiBrief) {
  const mode = aiBrief.writer_mode === "model" ? "OpenAI live model" : aiBrief.writer_mode === "fallback" ? "Deterministic fallback" : "Not prepared";
  const citations = (aiBrief.citations || []).map((citation) => `- ${citation.claim}\n  - Evidence: ${(citation.evidence_ids || []).join(", ") || "None"}\n  - Rules: ${(citation.rule_ids || []).join(", ") || "None"}`).join("\n");
  currentBriefMarkdown = `---\nprotocol: klear-case-brief/v1\ncase_id: ${decisionCase.case_id}\nsource_version: ${decisionCase.version}\nwriter_mode: ${aiBrief.writer_mode || "none"}\n---\n\n# Grounded Case Brief\n\n## Summary\n${aiBrief.summary || "No brief prepared."}\n\n## Risk\n${aiBrief.risk_explanation || "Not established."}\n\n## Recommended Disposition\n${aiBrief.recommended_disposition || "No recommendation."}\n\n## Missing Information\n${aiBrief.missing_information_request || "None recorded."}\n\n## Citations\n${citations || "- None recorded."}\n`;
  el("brief-filename").textContent = `${decisionCase.case_id}-case-brief.md`;
  el("brief-file-meta").textContent = mode;
  el("brief-artifact-state").textContent = mode;
  el("brief-artifact-state").className = `pill ${aiBrief.writer_mode ? "ready" : ""}`;
  el("case-brief-document").innerHTML = `
    <h3>Summary</h3><p>${escapeHtml(aiBrief.summary || "No grounded case brief has been prepared yet.")}</p>
    <h3>Risk</h3><p>${escapeHtml(aiBrief.risk_explanation || "Not established.")}</p>
    <h3>Recommended disposition</h3><p>${escapeHtml(aiBrief.recommended_disposition || "No recommendation.")}</p>
    <h3>Missing information</h3><p>${escapeHtml(aiBrief.missing_information_request || "None recorded.")}</p>
    <h3>Citations</h3>${renderRows(aiBrief.citations || [], (citation) => `${escapeHtml(citation.claim)}<br><span class="meta">Evidence: ${escapeHtml((citation.evidence_ids || []).join(", ") || "None")} · Rules: ${escapeHtml((citation.rule_ids || []).join(", ") || "None")}</span>`)}
  `;
}

function renderCaseWriterBadge(aiBrief = {}) {
  const badge = el("case-writer-badge");
  if (aiBrief.writer_mode === "model") {
    badge.textContent = "OPENAI LIVE";
    badge.className = "pill ready";
  } else {
    badge.textContent = aiBrief.writer_mode === "fallback" ? "OFFLINE BRIEF" : "NOT PREPARED";
    badge.className = "pill";
  }
}

function renderTraceability(traceability) {
  el("trace-rules").innerHTML = renderRows(traceability.rules, (rule) => `
    <strong>${rule.rule_id} ${rule.status}</strong><br>
    ${rule.summary}<br>
    <span class="meta">Evidence: ${rule.evidence.map((item) => item.evidence_id).join(", ") || rule.missing_evidence_reason || "None"}</span>
  `);
  el("trace-evidence").innerHTML = renderRows(traceability.evidence, (evidence) => `
    <strong>${evidence.evidence_id}</strong><br>
    ${evidence.source_type} · ${evidence.source_name}<br>
    <span class="meta">Rules: ${evidence.referenced_by_rule_ids.join(", ") || "None"}</span>
  `);
}

function renderTimeline(timeline) {
  el("timeline").innerHTML = timeline.events.map((event) => `
    <li>
      <strong>${event.label}</strong><br>
      <span class="meta">${formatTime(event.timestamp)} · ${event.actor?.name || event.actor?.role || "Unknown"}</span><br>
      ${event.note || ""}
    </li>
  `).join("");
}

function renderHandoff(handoff) {
  const machine = handoff.machine_readable;
  const nextOwner = machine.next_owner?.name || machine.next_owner?.role || "Unassigned";
  const decision = machine.latest_decision_event?.action || machine.human_decision?.decision || "No human decision";
  const requiredAction = machine.required_actions?.[0] || machine.unresolved_items?.[0] || "Review the current case state.";
  currentHandoffMarkdown = `---\nprotocol: klear-handoff/v1\nhandoff_id: ${machine.handoff_id}\ncase_id: ${machine.case_id}\nsource_version: ${machine.generated_from_case_version}\ndecision_event: ${machine.generated_from_decision_event || "none"}\nnext_owner: ${nextOwner}\n---\n\n${handoff.human_readable}`;
  el("handoff-filename").textContent = `${machine.case_id}-decision-handoff.md`;
  el("handoff-file-meta").textContent = `${formatStatus(decision)} · v${machine.generated_from_case_version}`;
  el("handoff-lineage").textContent = `${machine.handoff_id} · Case v${machine.generated_from_case_version} · ${machine.generated_from_decision_event || "No decision event"}`;
  el("handoff-overview").innerHTML = `
    <span class="eyebrow">Decision handoff</span>
    <h3>${machine.case_id} · ${formatStatus(machine.status)}</h3>
    <div class="document-field"><span>Latest human action</span><strong>${formatStatus(decision)}</strong></div>
    <div class="document-field"><span>Next owner</span><strong>${nextOwner}</strong></div>
    <div class="document-field"><span>Required next action</span><strong>${requiredAction}</strong></div>
    <div class="document-field"><span>Evidence references</span><strong>${machine.evidence_ids?.length || 0}</strong></div>
    <div class="document-field"><span>Rule references</span><strong>${machine.rule_ids?.length || 0}</strong></div>
  `;
  el("handoff-markdown").textContent = currentHandoffMarkdown;
  el("handoff-json").textContent = JSON.stringify(machine, null, 2);
}

function seedPackBack(story) {
  const machine = story.latest_handoff.machine_readable;
  const count = machine.pack_back_events?.length || 0;
  el("packback-file-meta").textContent = count ? `${count} return update${count === 1 ? "" : "s"} recorded` : "Return an update to this case";
  el("packback-form").payload.value = JSON.stringify({
    case_id: story.case_id,
    source_case_version: story.version,
    handoff_id: machine.handoff_id,
    responding_actor: { role: "NEXT_OWNER", name: "Accounts Payable" },
    event_type: "ACTION_COMPLETED",
    completed_actions: ["Reviewed decision handoff."],
    new_evidence: [],
    changed_fields: [],
    unresolved_items: [],
    note: "Action completed from handoff.",
    timestamp: new Date().toISOString()
  }, null, 2);
}

document.querySelectorAll(".tabs button").forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

document.querySelectorAll("[data-artifact]").forEach((button) => {
  button.addEventListener("click", () => openArtifact(button.dataset.artifact));
});

el("inspect-finding").addEventListener("click", () => switchTab("evidence"));
el("open-full-brief").addEventListener("click", () => openArtifact("brief"));
el("close-artifact").addEventListener("click", () => el("artifact-dialog").close());
el("next-action-button").addEventListener("click", () => {
  const action = el("next-action-button").dataset.action;
  if (action === "handoff") return openArtifact("handoff");
  if (action === "review") return el("run-review").click();
  switchTab(action || "review");
});

el("refresh").addEventListener("click", resetWorkspaceView);
el("intro-next").addEventListener("click", () => {
  el("intro-slide-1").hidden = true;
  el("intro-slide-2").hidden = false;
});
el("intro-continue").addEventListener("click", () => dismissIntro());
el("skip-intro").addEventListener("click", () => dismissIntro());
el("show-demo").addEventListener("click", () => {
  demoRunnerPinned = true;
  el("demo-runner").hidden = false;
  el("show-demo").classList.remove("demo-cta-pulse");
  el("start-live-demo").click();
});
el("hide-demo").addEventListener("click", () => {
  demoRunnerPinned = false;
  el("demo-runner").hidden = Boolean(selectedCaseId);
});
el("packet-select").addEventListener("change", renderSelectedPacket);
window.addEventListener("beforeunload", () => {
  liveModelCredentials = { api_key: "" };
});

async function runBankMismatchDemo({ credentials = null } = {}) {
  const usingLiveModel = Boolean(credentials?.api_key);
  el("start-live-demo").classList.remove("demo-cta-pulse");
  el("show-demo").classList.remove("demo-cta-pulse");
  setRunwayBusy(true, usingLiveModel ? "live" : "offline");
  clearProofSteps();
  const lines = [
    `Starting bank-mismatch simulation in ${usingLiveModel ? "live model" : "offline"} mode...`,
    "Scenario: invoice, PO, and vendor exist, but the submitted bank account differs from vendor master."
  ];
  writeRunway(lines);

  try {
    activateProofStep(0, "Receiving intake...", "Receiving invoice and source records...");
    let decisionCase;
    let reusedCuratedHero = false;
    if (curatedHeroCaseId) {
      decisionCase = (await api(`/cases/${curatedHeroCaseId}`)).case;
      reusedCuratedHero = true;
      selectedCaseId = decisionCase.case_id;
      await selectCase(decisionCase.case_id);
    } else {
      decisionCase = await importDemoPacket("DEMO-HANDOFF-SCN-BANK-MISMATCH");
    }
    setProofStepLabel(0, PROOF_STEP_LABELS[0]);
    markProofStep(0);
    lines.push(`Intake received as ${decisionCase.case_id}.`);
    writeRunway(lines);
    await sleep(650);

    activateProofStep(1, "Verifying truth...", "Running deterministic evidence and policy checks...");
    const reviewed = reusedCuratedHero
      ? { case: decisionCase }
      : await runTruthReview(decisionCase.case_id);
    const bankRule = reviewed.case.rule_results.find((rule) => rule.rule_id === "R-003");
    setProofStepLabel(1, PROOF_STEP_LABELS[1]);
    markProofStep(1);
    lines.push(`Truth lane result: ${bankRule.rule_id} ${bankRule.status} - ${bankRule.summary}`);
    writeRunway(lines);
    await selectCase(decisionCase.case_id);
    await sleep(650);

    if (!usingLiveModel) {
      activateProofStep(2, "Checking OpenAI connection...", "Checking whether the live case writer is available...");
      await sleep(450);
      setProofStepLabel(2, "OpenAI not connected");
      markProofStep(2, "blocked");
      setRunwayActivity("Stopped: connect OpenAI to prepare the grounded brief.", "error");
      lines.push("OPENAI NOT CONNECTED: the live grounded case brief cannot be prepared.");
      lines.push("Truth verification completed, but this decision journey remains incomplete.");
      writeRunway(lines);
      setModelConnectionState("OpenAI not connected", "Live case writer unavailable");
      el("case-brief-result").textContent = "Offline stopped after truth verification. Connect OpenAI to continue.";
      el("case-brief-result").classList.add("error");
      await loadCases();
      switchTab("evidence");
      document.querySelector(".app-shell").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    activateProofStep(2, "Preparing grounded brief...", "OpenAI is preparing a grounded brief from verified facts, evidence, and rule results...");
    const brief = await prepareLiveBrief(decisionCase.case_id, credentials);
    setProofStepLabel(2, PROOF_STEP_LABELS[2]);
    markProofStep(2);
    if (brief.case_writer.model_called) {
      lines.push("Grounded case brief prepared by OpenAI.");
      setModelConnectionState("OpenAI live", "Connected for this request", "connected");
      el("case-brief-result").textContent = "OPENAI LIVE generated the grounded brief.";
      el("case-brief-result").classList.remove("error");
    } else {
      throw new Error("OpenAI did not produce a live grounded brief.");
    }
    writeRunway(lines);
    await selectCase(decisionCase.case_id);
    await sleep(650);

    activateProofStep(3, "Testing approval guardrail...", "Testing whether the verified evidence state permits approval...");
    const approval = await attemptApproval(decisionCase.case_id);
    if (!approval.blocked) {
      throw new Error(approval.message);
    }
    markProofStep(3, "blocked");
    lines.push(`Unsafe approval blocked: ${approval.message}`);
    writeRunway(lines);
    await sleep(650);

    activateProofStep(4, "Recording human action...", "Recording the reviewer evidence request as an explicit decision event...");
    const decision = await requestEvidenceDecision(decisionCase.case_id);
    setProofStepLabel(4, PROOF_STEP_LABELS[4]);
    markProofStep(4);
    lines.push(`Human decision recorded: ${decision.decision_event.decision_event_id} REQUEST_EVIDENCE.`);
    writeRunway(lines);
    await selectCase(decisionCase.case_id);
    await sleep(650);

    activateProofStep(5, "Preparing handoff...", "Preparing the versioned handoff and acknowledgement...");
    const packBack = await importPackBackFromStory(currentStory);
    setProofStepLabel(5, PROOF_STEP_LABELS[5]);
    markProofStep(5, "pending");
    setRunwayActivity("Live review complete. Evidence remains pending.", "pending");
    lines.push(`Handoff acknowledged: ${packBack.pack_back.pack_back_id}. Evidence is still pending.`);
    lines.push("Proof: the payment remains blocked until a human confirms the vendor bank account. AI prepared the case, but never closed it.");
    writeRunway(lines);
    await selectCase(decisionCase.case_id);
    await loadCases();
    switchTab("timeline");
    document.querySelector(".app-shell").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    failActiveProofStep();
    setRunwayActivity(`Stopped: ${error.message}`, "error");
    lines.push(`Demo stopped: ${error.message}`);
    writeRunway(lines);
    setModelConnectionState("OpenAI connection failed", "Check the API key and server configuration");
    el("case-brief-result").textContent = error.message;
    el("case-brief-result").classList.add("error");
  } finally {
    setRunwayBusy(false);
  }
}

el("start-live-demo").addEventListener("click", () => runBankMismatchDemo());
el("run-offline-demo").addEventListener("click", () => runBankMismatchDemo());

el("compare-intakes").addEventListener("click", async () => {
  setRunwayBusy(true);
  clearProofSteps();
  const lines = ["Comparing good structured handoff vs messy intake..."];
  writeRunway(lines);

  try {
    const clean = await importDemoPacket("DEMO-HANDOFF-SCN-CLEAN");
    await runTruthReview(clean.case_id);
    const cleanStory = (await api(`/cases/${clean.case_id}/decision-story`)).decision_story;
    lines.push(`Good handoff ${clean.case_id}: decision-ready, ${cleanStory.readiness.blocking_rule_count} blockers, ${cleanStory.readiness.unknown_count} unknowns.`);
    writeRunway(lines);

    const messy = await importDemoPacket("DEMO-MESSY-SCN-MISSING-VENDOR");
    await runTruthReview(messy.case_id);
    const messyStory = (await api(`/cases/${messy.case_id}/decision-story`)).decision_story;
    lines.push(`Messy intake ${messy.case_id}: not decision-ready, ${messyStory.readiness.blocking_rule_count} blockers, ${messyStory.readiness.unknown_count} unknowns.`);
    lines.push("Takeaway: KLEAR does not pretend messy input is complete. It preserves unknowns and asks for evidence.");
    writeRunway(lines);

    await selectCase(messy.case_id);
    await loadCases();
    switchTab("review");
    document.querySelector(".app-shell").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    lines.push(`Comparison stopped: ${error.message}`);
    writeRunway(lines);
  } finally {
    setRunwayBusy(false);
  }
});

el("open-console").addEventListener("click", () => {
  document.querySelector(".app-shell").scrollIntoView({ behavior: "smooth", block: "start" });
});

el("import-packet").addEventListener("click", async () => {
  const item = selectedPacket();
  if (!item) return;
  try {
    const decisionCase = await importDemoPacket(item.packet_id);
    writeRunway(`Imported ${item.label} as ${decisionCase.case_id}.`);
    switchTab("review");
  } catch (error) {
    writeRunway(error.message);
  }
});

el("run-review").addEventListener("click", async () => {
  if (!selectedCaseId) return;
  try {
    const result = await runTruthReview(selectedCaseId);
    writeRunway(`Truth review complete: ${result.deterministic_review.rule_count} rules, ${result.deterministic_review.unknown_count} unknowns.`);
    await selectCase(selectedCaseId);
    await loadCases();
  } catch (error) {
    writeRunway(error.message);
  }
});

el("run-brief").addEventListener("click", async () => {
  if (!selectedCaseId) return;
  setModelConnectionState("OpenAI not connected", "Live case writer unavailable");
  el("case-brief-result").textContent = "Connect OpenAI before preparing the grounded brief.";
  el("case-brief-result").classList.add("error");
  writeRunway("Grounded brief unavailable: connect OpenAI to continue the live decision journey.");
  openLiveModelSetup();
});

el("try-blocked-approve").addEventListener("click", async () => {
  if (!selectedCaseId || !currentStory) return;
  if (currentStory.readiness.ready_for_decision) {
    el("runway-result").textContent = "This case is ready, so blocked-approve proof is not expected. Import a bank-mismatch or missing-evidence packet.";
    return;
  }
  const approval = await attemptApproval(selectedCaseId);
  writeRunway(approval.blocked ? `Guardrail held: ${approval.message}` : approval.message);
  if (approval.blocked) markProofStep(3, "blocked");
});

el("request-evidence").addEventListener("click", async () => {
  if (!selectedCaseId) return;
  try {
    const result = await requestEvidenceDecision(selectedCaseId);
    writeRunway(`Human decision event recorded: ${result.decision_event.decision_event_id}.`);
    await selectCase(selectedCaseId);
    await loadCases();
    openArtifact("handoff");
  } catch (error) {
    writeRunway(error.message);
  }
});

el("open-handoff").addEventListener("click", () => {
  if (!selectedCaseId) return;
  openArtifact("handoff");
});

el("import-demo-packback").addEventListener("click", async () => {
  if (!selectedCaseId) return;
  try {
    const payload = JSON.parse(el("packback-form").payload.value);
    const result = await api(`/cases/${selectedCaseId}/pack-back`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    writeRunway(`Pack Back imported: ${result.pack_back.pack_back_id}.`);
    await selectCase(selectedCaseId);
    await loadCases();
    switchTab("timeline");
  } catch (error) {
    writeRunway(error.message);
  }
});

function clearLiveModelApiKey(form = el("case-brief-form")) {
  liveModelCredentials = { ...liveModelCredentials, api_key: "" };
  form.api_key.value = "";
}

async function openLiveModelSetup() {
  el("model-connection").scrollIntoView({ behavior: "smooth", block: "start" });
  requestAnimationFrame(() => el("case-brief-form").api_key.focus());
}

el("show-live-model").addEventListener("click", () => {
  openLiveModelSetup().catch((error) => writeRunway(error.message));
});

el("clear-model-key").addEventListener("click", () => clearLiveModelApiKey());

el("case-brief-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  liveModelCredentials = {
    api_key: form.api_key.value
  };
  setModelConnectionState("Connecting to OpenAI...", "Request-scoped API key", "connecting");
  el("case-brief-result").textContent = "Running the same decision workflow with a live case writer.";
  el("case-brief-result").classList.remove("error");
  try {
    await runBankMismatchDemo({ credentials: { ...liveModelCredentials } });
  } finally {
    clearLiveModelApiKey(form);
  }
});

el("copy-brief").addEventListener("click", () => artifactCopy("Case brief", currentBriefMarkdown));
el("download-brief").addEventListener("click", () => downloadText(`${selectedCaseId}-case-brief.md`, currentBriefMarkdown));
el("copy-handoff").addEventListener("click", () => artifactCopy("Decision handoff", currentHandoffMarkdown));
el("download-handoff").addEventListener("click", () => downloadText(`${selectedCaseId}-decision-handoff.md`, currentHandoffMarkdown));

el("decision-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const action = data.get("action");
  if (!confirm(`Record ${action} as an explicit human decision?`)) return;
  const payload = {
    action,
    reviewer: { role: "REVIEWER", name: data.get("reviewer_name") },
    reason: data.get("reason"),
    required_evidence: data.get("required_evidence") ? [data.get("required_evidence")] : [],
    escalation_target: data.get("escalation_target") ? { role: "NEXT_OWNER", name: data.get("escalation_target") } : null
  };
  try {
    const result = await api(`/cases/${selectedCaseId}/decisions`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    el("decision-result").textContent = JSON.stringify(result.decision_event, null, 2);
    await selectCase(selectedCaseId);
    await loadCases();
  } catch (error) {
    el("decision-result").textContent = error.message;
  }
});

el("packback-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = JSON.parse(event.currentTarget.payload.value);
    const result = await api(`/cases/${selectedCaseId}/pack-back`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    el("packback-result").textContent = JSON.stringify(result.pack_back, null, 2);
    await selectCase(selectedCaseId);
    await loadCases();
  } catch (error) {
    el("packback-result").textContent = error.message;
  }
});

initializeIntro();

Promise.all([loadDemoIntakePackets(), loadCases()]).catch((error) => {
  el("case-list").innerHTML = `<p class="meta">${error.message}</p>`;
  el("runway-result").textContent = error.message;
});
