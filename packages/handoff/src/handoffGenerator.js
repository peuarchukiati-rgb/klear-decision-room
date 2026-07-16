export function createMachineHandoff(decisionCase) {
  return {
    case_id: decisionCase.case_id,
    case_type: decisionCase.case_type,
    version: decisionCase.version,
    status: decisionCase.status,
    current_owner: decisionCase.current_owner,
    next_owner: decisionCase.next_owner,
    unresolved_items: decisionCase.unknowns,
    blocking_rules: decisionCase.rule_results
      .filter((rule) => rule.recommended_gate === "HOLD" || rule.status === "FAIL")
      .map((rule) => rule.rule_id),
    required_actions: []
  };
}

export function createHumanHandoff(decisionCase) {
  const lines = [
    "# Decision Handoff",
    "",
    `Case: ${decisionCase.case_id}`,
    `Version: ${decisionCase.version}`,
    `Status: ${decisionCase.status}`,
    `Current owner: ${decisionCase.current_owner?.name || decisionCase.current_owner?.role || "Unknown"}`,
    `Next owner: ${decisionCase.next_owner?.name || decisionCase.next_owner?.role || "Unknown"}`,
    "",
    "## Current Decision State",
    decisionCase.human_decision?.decision
      ? `${decisionCase.human_decision.decision}: ${decisionCase.human_decision.reason || ""}`
      : "No human decision has been recorded.",
    "",
    "## Unknowns",
    ...(decisionCase.unknowns.length
      ? decisionCase.unknowns.map((item) => `- ${item.summary || item.field || JSON.stringify(item)}`)
      : ["- None recorded."]),
    "",
    "## Supporting References",
    ...(decisionCase.evidence.length
      ? decisionCase.evidence.map((item) => `- ${item.evidence_id}: ${item.source_name || item.source_type}`)
      : ["- None recorded."])
  ];

  return `${lines.join("\n")}\n`;
}

export function createHandoffArtifacts(decisionCase) {
  return {
    human_readable: createHumanHandoff(decisionCase),
    machine_readable: createMachineHandoff(decisionCase)
  };
}
