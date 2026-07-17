let selectedCaseId = null;
let currentStory = null;
let demoIntakePackets = [];
let liveModelCredentials = {
  api_key: "",
  model_id: ""
};

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

function vendorFromCase(decisionCase) {
  const fact = decisionCase.facts.find((item) => item.field === "vendor_name");
  if (fact) return fact.value;
  return decisionCase.input_records.find((item) => item.source_type === "INVOICE")?.payload?.vendor_name || "Unknown vendor";
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
  renderSelectedPacket();
}

function renderSelectedPacket() {
  const item = selectedPacket();
  el("packet-preview").textContent = item ? JSON.stringify(item.packet, null, 2) : "No demo intake packets available.";
}

function updateRunway(story = currentStory) {
  const decisionCase = story?.latest_handoff?.machine_readable;
  const steps = Array.from(document.querySelectorAll("#runway-steps .step"));
  const states = [
    Boolean(decisionCase),
    Boolean(decisionCase?.rule_results?.length),
    Boolean(decisionCase?.ai_case_brief?.summary),
    Boolean(decisionCase?.human_decision_events?.length),
    Boolean(story?.latest_handoff?.metadata || story?.latest_handoff),
    Boolean(decisionCase?.pack_back_events?.length)
  ];
  steps.forEach((step, index) => step.classList.toggle("done", states[index]));
  el("runway-status").textContent = decisionCase
    ? `${decisionCase.case_id} · ${decisionCase.status}`
    : "No intake imported";
}

async function loadCases() {
  const { cases } = await api("/cases");
  el("case-count").textContent = `${cases.length} cases`;
  el("case-list").innerHTML = cases.map((decisionCase) => `
    <button class="case-card" data-case-id="${decisionCase.case_id}">
      <strong>${decisionCase.case_id}</strong>
      <span>${vendorFromCase(decisionCase)} · ${moneyFromCase(decisionCase)}</span>
      <span class="meta">${decisionCase.status} · ${severityFromCase(decisionCase)} · ${decisionCase.current_owner?.name || decisionCase.current_owner?.role || "Unassigned"}</span>
      <span class="meta">Updated ${decisionCase.updated_at}</span>
    </button>
  `).join("");
  document.querySelectorAll("[data-case-id]").forEach((button) => {
    button.addEventListener("click", () => selectCase(button.dataset.caseId));
  });
  if (!selectedCaseId && cases[0]) {
    await selectCase(cases[0].case_id);
  }
}

async function selectCase(caseId) {
  selectedCaseId = caseId;
  const { decision_story } = await api(`/cases/${caseId}/decision-story`);
  currentStory = decision_story;
  renderCase(decision_story);
}

function renderCase(story) {
  const decisionCase = story.latest_handoff.machine_readable;
  updateRunway(story);
  el("empty-state").hidden = true;
  el("case-view").hidden = false;
  el("case-title").textContent = decisionCase.case_id;
  el("case-subtitle").textContent = `${vendorFromCase(decisionCase)} · ${moneyFromCase(decisionCase)} · Owner: ${decisionCase.current_owner?.name || decisionCase.current_owner?.role || "Unassigned"}`;
  el("case-status").textContent = decisionCase.status;
  el("case-readiness").textContent = story.readiness.ready_for_decision ? "Ready for decision" : "Evidence required";
  el("case-readiness").className = `pill ${story.readiness.ready_for_decision ? "ready" : "blocked"}`;

  el("facts").innerHTML = decisionCase.facts.map((fact) => `<dt>${fact.field}</dt><dd>${fact.value}</dd>`).join("") || "<p class=\"meta\">No normalized facts yet.</p>";
  el("readiness").innerHTML = `
    ${pill(`Evidence ${story.readiness.evidence_completeness_percent}%`, story.readiness.evidence_completeness_percent === 100)}
    ${pill(`Policy ${story.readiness.policy_coverage_percent}%`, story.readiness.policy_coverage_percent === 100)}
    ${pill(`${story.readiness.unknown_count} unknown`, story.readiness.unknown_count === 0)}
    ${pill(`${story.readiness.blocking_rule_count} blockers`, story.readiness.blocking_rule_count === 0)}
    ${renderRows(story.readiness.readiness_reasons, (reason) => reason)}
  `;
  const brief = decisionCase.human_decision?.decision
    ? `Latest human decision: ${decisionCase.human_decision.decision}\n${decisionCase.human_decision.reason || ""}`
    : "No human decision recorded yet.";
  const aiBrief = decisionCase.ai_case_brief || {};
  renderCaseWriterBadge(aiBrief);
  el("case-brief").textContent = [
    aiBrief.summary ? `Summary: ${aiBrief.summary}` : "No grounded case brief prepared yet.",
    aiBrief.risk_explanation ? `Risk: ${aiBrief.risk_explanation}` : "",
    aiBrief.recommended_disposition ? `Recommended disposition: ${aiBrief.recommended_disposition}` : "",
    aiBrief.missing_information_request ? `Missing information request: ${aiBrief.missing_information_request}` : "",
    brief
  ].filter(Boolean).join("\n\n");
  el("rules").innerHTML = renderRows(decisionCase.rule_results, (rule) => `<strong>${rule.rule_id} ${rule.status}</strong><br>${rule.summary}<br><span class="meta">Evidence: ${(rule.evidence_ids || []).join(", ") || "None"}</span>`);
  el("unknowns").innerHTML = renderRows(decisionCase.unknowns, (item) => `${item.summary || item.field}<br><span class="meta">${item.evidence_unavailable_reason || ""}</span>`);
  renderTraceability(story.traceability);
  renderTimeline(story.timeline);
  renderHandoff(story.latest_handoff);
  seedPackBack(story);
}

function renderCaseWriterBadge(aiBrief = {}) {
  const badge = el("case-writer-badge");
  if (aiBrief.writer_mode === "model") {
    badge.textContent = `LIVE MODEL: ${aiBrief.model_id || "configured model"}`;
    badge.className = "pill ready";
  } else {
    badge.textContent = aiBrief.writer_mode === "fallback" ? "FALLBACK (no key)" : "NO BRIEF";
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
      <span class="meta">${event.timestamp} · ${event.actor?.name || event.actor?.role || "Unknown"}</span><br>
      ${event.note || ""}
    </li>
  `).join("");
}

function renderHandoff(handoff) {
  el("handoff-markdown").textContent = handoff.human_readable;
  el("handoff-json").textContent = JSON.stringify(handoff.machine_readable, null, 2);
}

function seedPackBack(story) {
  const machine = story.latest_handoff.machine_readable;
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

el("refresh").addEventListener("click", loadCases);
el("packet-select").addEventListener("change", renderSelectedPacket);
window.addEventListener("beforeunload", () => {
  liveModelCredentials = { api_key: "", model_id: "" };
});

el("import-packet").addEventListener("click", async () => {
  const item = selectedPacket();
  if (!item) return;
  try {
    const result = await api("/intake-packets", {
      method: "POST",
      body: JSON.stringify({ packet: item.packet })
    });
    selectedCaseId = result.case.case_id;
    el("runway-result").textContent = `Imported ${item.label} as ${selectedCaseId}.`;
    await loadCases();
    await selectCase(selectedCaseId);
    switchTab("review");
  } catch (error) {
    el("runway-result").textContent = error.message;
  }
});

el("run-review").addEventListener("click", async () => {
  if (!selectedCaseId) return;
  try {
    const result = await api(`/cases/${selectedCaseId}/deterministic-review`, {
      method: "POST",
      body: JSON.stringify({})
    });
    el("runway-result").textContent = `Truth review complete: ${result.deterministic_review.rule_count} rules, ${result.deterministic_review.unknown_count} unknowns.`;
    await selectCase(selectedCaseId);
    await loadCases();
  } catch (error) {
    el("runway-result").textContent = error.message;
  }
});

el("run-brief").addEventListener("click", async () => {
  if (!selectedCaseId) return;
  try {
    const result = await api(`/cases/${selectedCaseId}/case-brief`, {
      method: "POST",
      body: JSON.stringify({})
    });
    el("runway-result").textContent = result.case_writer.model_called
      ? `Live model prepared brief with ${result.case_writer.model_id}.`
      : "Fallback brief prepared without model credentials.";
    await selectCase(selectedCaseId);
    await loadCases();
    switchTab("review");
  } catch (error) {
    el("runway-result").textContent = error.message;
  }
});

el("try-blocked-approve").addEventListener("click", async () => {
  if (!selectedCaseId || !currentStory) return;
  if (currentStory.readiness.ready_for_decision) {
    el("runway-result").textContent = "This case is ready, so blocked-approve proof is not expected. Import a bank-mismatch or missing-evidence packet.";
    return;
  }
  try {
    await api(`/cases/${selectedCaseId}/decisions`, {
      method: "POST",
      body: JSON.stringify({
        action: "APPROVE",
        reviewer: { role: "REVIEWER", name: "Guardrail Tester" },
        reason: "Intentional guardrail proof."
      })
    });
    el("runway-result").textContent = "Unexpected: approval succeeded.";
  } catch (error) {
    el("runway-result").textContent = `Guardrail held: ${error.message}`;
  }
});

el("request-evidence").addEventListener("click", async () => {
  if (!selectedCaseId) return;
  try {
    const result = await api(`/cases/${selectedCaseId}/decisions`, {
      method: "POST",
      body: JSON.stringify({
        action: "REQUEST_EVIDENCE",
        reviewer: { role: "REVIEWER", name: "Finance Reviewer" },
        reason: "Evidence is required before a payment decision can be made.",
        required_evidence: ["Provide vendor bank confirmation or missing support for unresolved hard-gate rules."]
      })
    });
    el("runway-result").textContent = `Human decision event recorded: ${result.decision_event.decision_event_id}.`;
    await selectCase(selectedCaseId);
    await loadCases();
    switchTab("handoff");
  } catch (error) {
    el("runway-result").textContent = error.message;
  }
});

el("open-handoff").addEventListener("click", () => {
  if (!selectedCaseId) return;
  switchTab("handoff");
});

el("import-demo-packback").addEventListener("click", async () => {
  if (!selectedCaseId) return;
  try {
    const payload = JSON.parse(el("packback-form").payload.value);
    const result = await api(`/cases/${selectedCaseId}/pack-back`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    el("runway-result").textContent = `Pack Back imported: ${result.pack_back.pack_back_id}.`;
    await selectCase(selectedCaseId);
    await loadCases();
    switchTab("timeline");
  } catch (error) {
    el("runway-result").textContent = error.message;
  }
});

el("clear-model-key").addEventListener("click", () => {
  liveModelCredentials = { api_key: "", model_id: "" };
  el("case-brief-form").api_key.value = "";
});

el("case-brief-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  liveModelCredentials = {
    api_key: form.api_key.value,
    model_id: form.model_id.value
  };
  const payload = {};
  if (liveModelCredentials.api_key) payload.api_key = liveModelCredentials.api_key;
  if (liveModelCredentials.model_id) payload.model_id = liveModelCredentials.model_id;

  try {
    const result = await api(`/cases/${selectedCaseId}/case-brief`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    el("case-brief-result").textContent = result.case_writer.model_called
      ? `LIVE MODEL generated brief with ${result.case_writer.model_id}.`
      : "Fallback brief generated without a model call.";
    await selectCase(selectedCaseId);
    await loadCases();
  } catch (error) {
    el("case-brief-result").textContent = error.message;
  }
});

el("copy-handoff").addEventListener("click", async () => {
  await navigator.clipboard.writeText(el("handoff-markdown").textContent);
});

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

Promise.all([loadDemoIntakePackets(), loadCases()]).catch((error) => {
  el("case-list").innerHTML = `<p class="meta">${error.message}</p>`;
  el("runway-result").textContent = error.message;
});
