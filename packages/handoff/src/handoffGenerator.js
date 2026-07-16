export function latestDecisionEvent(decisionCase) {
  return (decisionCase.human_decision_events || []).at(-1) || null;
}

function handoffId(decisionCase, decisionEvent) {
  const decisionPart = decisionEvent?.decision_event_id || "NO-DECISION";
  return `HANDOFF-${decisionCase.case_id}-V${decisionCase.version}-${decisionPart}`;
}

function evidenceIds(decisionCase) {
  return decisionCase.evidence.map((item) => item.evidence_id);
}

function ruleIds(decisionCase) {
  return decisionCase.rule_results.map((item) => item.rule_id);
}

export function createMachineHandoff(decisionCase, { generated_at = new Date().toISOString() } = {}) {
  const decisionEvent = latestDecisionEvent(decisionCase);
  return {
    handoff_id: handoffId(decisionCase, decisionEvent),
    generated_at,
    generated_from_case_version: decisionCase.version,
    generated_from_decision_event: decisionEvent?.decision_event_id || null,
    case_id: decisionCase.case_id,
    case_type: decisionCase.case_type,
    version: decisionCase.version,
    status: decisionCase.status,
    current_owner: decisionCase.current_owner,
    next_owner: decisionCase.next_owner,
    input_records: decisionCase.input_records,
    facts: decisionCase.facts,
    rule_results: decisionCase.rule_results,
    unknowns: decisionCase.unknowns,
    evidence: decisionCase.evidence,
    ai_case_brief: decisionCase.ai_case_brief,
    human_decision: decisionCase.human_decision,
    latest_decision_event: decisionEvent,
    evidence_ids: evidenceIds(decisionCase),
    rule_ids: ruleIds(decisionCase),
    unresolved_items: decisionCase.unknowns,
    blocking_rules: decisionCase.rule_results
      .filter((rule) => rule.recommended_gate === "HOLD" || rule.status === "FAIL")
      .map((rule) => rule.rule_id),
    required_actions: decisionCase.human_decision?.required_evidence || []
  };
}

export function createHumanHandoff(decisionCase, options = {}) {
  const machine = createMachineHandoff(decisionCase, options);
  const decisionEvent = machine.latest_decision_event;
  const lines = [
    "# Decision Handoff",
    "",
    `Handoff: ${machine.handoff_id}`,
    `Case: ${decisionCase.case_id}`,
    `Version: ${decisionCase.version}`,
    `Generated from case version: ${machine.generated_from_case_version}`,
    `Generated from decision event: ${machine.generated_from_decision_event || "None"}`,
    `Status: ${decisionCase.status}`,
    `Current owner: ${decisionCase.current_owner?.name || decisionCase.current_owner?.role || "Unknown"}`,
    `Next owner: ${decisionCase.next_owner?.name || decisionCase.next_owner?.role || "Unknown"}`,
    "",
    "## Current Decision State",
    decisionCase.human_decision?.decision
      ? `${decisionCase.human_decision.decision}: ${decisionCase.human_decision.reason || ""}`
      : "No human decision has been recorded.",
    decisionEvent ? `Decision owner: ${decisionEvent.reviewer?.name || decisionEvent.reviewer?.role || "Unknown"}` : "",
    "",
    "## Verified Facts",
    ...(decisionCase.facts.length
      ? decisionCase.facts.map((item) => `- ${item.field}: ${item.value}`)
      : ["- None recorded."]),
    "",
    "## Rules",
    ...(decisionCase.rule_results.length
      ? decisionCase.rule_results.map((rule) => `- ${rule.rule_id} ${rule.status}: ${rule.summary}`)
      : ["- None recorded."]),
    "",
    "## Unknowns",
    ...(decisionCase.unknowns.length
      ? decisionCase.unknowns.map((item) => `- ${item.summary || item.field || JSON.stringify(item)}`)
      : ["- None recorded."]),
    "",
    "## Required Next Action",
    ...(machine.required_actions.length
      ? machine.required_actions.map((item) => `- ${typeof item === "string" ? item : JSON.stringify(item)}`)
      : ["- None recorded."]),
    "",
    "## Supporting References",
    ...(decisionCase.evidence.length
      ? decisionCase.evidence.map((item) => `- ${item.evidence_id}: ${item.source_name || item.source_type}`)
      : ["- None recorded."]),
    "",
    "## Machine-readable Plane",
    "",
    "```json",
    JSON.stringify(machine, null, 2),
    "```"
  ];

  return `${lines.join("\n")}\n`;
}

export function createHandoffArtifacts(decisionCase, options = {}) {
  const artifactOptions = {
    generated_at: options.generated_at || new Date().toISOString()
  };
  return {
    human_readable: createHumanHandoff(decisionCase, artifactOptions),
    machine_readable: createMachineHandoff(decisionCase, artifactOptions)
  };
}
