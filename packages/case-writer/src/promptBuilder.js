export const ALLOWED_RECOMMENDATIONS = Object.freeze([
  "APPROVE",
  "REJECT",
  "HOLD",
  "REQUEST_EVIDENCE",
  "ESCALATE"
]);

export function hardGateActive(decisionCase) {
  return decisionCase.rule_results.some((rule) => {
    return rule.status === "FAIL" || rule.status === "UNKNOWN" || rule.recommended_gate === "HOLD";
  });
}

export function allowedRecommendationsForCase(decisionCase) {
  if (hardGateActive(decisionCase)) {
    return ["HOLD", "REQUEST_EVIDENCE", "ESCALATE", "REJECT"];
  }
  return [...ALLOWED_RECOMMENDATIONS];
}

export function buildCaseWriterInput(decisionCase, policy = {}) {
  return {
    case_id: decisionCase.case_id,
    case_type: decisionCase.case_type,
    version: decisionCase.version,
    status: decisionCase.status,
    facts: decisionCase.facts,
    rule_results: decisionCase.rule_results,
    unknowns: decisionCase.unknowns,
    evidence: decisionCase.evidence.map((item) => ({
      evidence_id: item.evidence_id,
      source_type: item.source_type,
      source_name: item.source_name,
      source_location: item.source_location,
      field: item.field,
      value: item.value,
      confidence: item.confidence,
      verified: item.verified
    })),
    policy: {
      policy_id: policy.policy_id || "",
      name: policy.name || "",
      version: policy.version || null,
      fraud_language_note: policy.fraud_language_note || ""
    },
    allowed_recommendations: allowedRecommendationsForCase(decisionCase)
  };
}

export function buildCaseWriterMessages(decisionCase, policy = {}) {
  const writerInput = buildCaseWriterInput(decisionCase, policy);
  return [
    {
      role: "system",
      content: [
        "You are the controlled case-writing layer for KLEAR Decision Room.",
        "Use only supplied facts, deterministic rule results, unknowns, evidence metadata, policy text, and allowed recommendation values.",
        "Never invent values, evidence IDs, rule IDs, source IDs, or facts.",
        "Preserve unknowns. Do not convert unknown information into facts.",
        "Do not reinterpret deterministic failures as passes.",
        "Do not recommend APPROVE when a hard-gate rule has failed or is unknown.",
        "Distinguish fact, inference, and recommendation.",
        "Use cautious language for fraud, identity, compliance, and intent.",
        "Return only valid JSON matching the supplied schema."
      ].join(" ")
    },
    {
      role: "user",
      content: JSON.stringify(writerInput)
    }
  ];
}
