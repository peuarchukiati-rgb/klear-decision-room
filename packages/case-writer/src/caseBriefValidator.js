import { allowedRecommendationsForCase, hardGateActive } from "./promptBuilder.js";

const REQUIRED_FIELDS = [
  "factual_summary",
  "decision_context",
  "risk_explanation",
  "recommended_disposition",
  "recommendation_reason",
  "missing_information_request",
  "next_owner_handoff",
  "citations",
  "model_warnings"
];

export function validateCaseBriefOutput(decisionCase, output) {
  const errors = [];
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    throw new Error("Case brief output must be an object");
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in output)) {
      errors.push(`missing field: ${field}`);
    }
  }

  if (!Array.isArray(output.citations)) {
    errors.push("citations must be an array");
  }

  if (!Array.isArray(output.model_warnings)) {
    errors.push("model_warnings must be an array");
  }

  const allowedRecommendations = allowedRecommendationsForCase(decisionCase);
  if (!allowedRecommendations.includes(output.recommended_disposition)) {
    errors.push(`recommended_disposition is not allowed: ${output.recommended_disposition}`);
  }

  if (hardGateActive(decisionCase) && output.recommended_disposition === "APPROVE") {
    errors.push("APPROVE is forbidden when a hard gate failed or is unknown");
  }

  const evidenceIds = new Set(decisionCase.evidence.map((item) => item.evidence_id));
  const ruleIds = new Set(decisionCase.rule_results.map((item) => item.rule_id));

  if (Array.isArray(output.citations)) {
    for (const [index, citation] of output.citations.entries()) {
      if (!citation || typeof citation !== "object") {
        errors.push(`citation ${index} must be an object`);
        continue;
      }
      if (!citation.claim) {
        errors.push(`citation ${index} missing claim`);
      }
      if (!Array.isArray(citation.evidence_ids)) {
        errors.push(`citation ${index} evidence_ids must be an array`);
      } else {
        for (const evidenceId of citation.evidence_ids) {
          if (!evidenceIds.has(evidenceId)) {
            errors.push(`citation ${index} references unknown evidence_id: ${evidenceId}`);
          }
        }
      }
      if (!Array.isArray(citation.rule_ids)) {
        errors.push(`citation ${index} rule_ids must be an array`);
      } else {
        for (const ruleId of citation.rule_ids) {
          if (!ruleIds.has(ruleId)) {
            errors.push(`citation ${index} references unknown rule_id: ${ruleId}`);
          }
        }
      }
      if ((citation.evidence_ids || []).length === 0 && (citation.rule_ids || []).length === 0) {
        errors.push(`citation ${index} must cite evidence or rules`);
      }
    }
  }

  if (errors.length) {
    throw new Error(`MODEL_OUTPUT_REJECTED: ${errors.join("; ")}`);
  }

  return true;
}

export function toDecisionCaseBrief(output) {
  return {
    summary: output.factual_summary,
    risk_explanation: output.risk_explanation,
    recommended_disposition: output.recommended_disposition,
    missing_information_request: output.missing_information_request,
    handoff_note: output.next_owner_handoff,
    citations: output.citations,
    decision_context: output.decision_context,
    recommendation_reason: output.recommendation_reason,
    model_warnings: output.model_warnings
  };
}
