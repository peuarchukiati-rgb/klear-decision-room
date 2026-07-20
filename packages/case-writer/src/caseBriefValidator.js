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
    throw new Error("MODEL_OUTPUT_REJECTED: case brief output must be an object");
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in output)) {
      errors.push(`missing field: ${field}`);
    }
  }

  for (const field of Object.keys(output)) {
    if (!REQUIRED_FIELDS.includes(field)) {
      errors.push(`unsupported field: ${field}`);
    }
  }

  if (!Array.isArray(output.citations)) {
    errors.push("citations must be an array");
  } else if (output.citations.length === 0) {
    errors.push("citations must include at least one grounded claim");
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

export function createCaseBriefValidationReceipt(
  decisionCase,
  output,
  {
    model_called = false,
    model_output_accepted = false,
    attempt_count = 0,
    rejected_attempts = [],
    fallback_used = false,
    validated_at = new Date().toISOString()
  } = {}
) {
  validateCaseBriefOutput(decisionCase, output);

  const citations = output.citations || [];
  const evidenceReferenceCount = citations.reduce((total, citation) => total + citation.evidence_ids.length, 0);
  const ruleReferenceCount = citations.reduce((total, citation) => total + citation.rule_ids.length, 0);
  const gateActive = hardGateActive(decisionCase);

  return {
    receipt_version: "klear-case-writer-validation/v1",
    status: fallback_used ? "PASSED_WITH_FALLBACK" : "PASSED",
    validated_at,
    model_called,
    model_output_accepted,
    attempt_count,
    rejected_attempt_count: rejected_attempts.length,
    fallback_used,
    checks: [
      {
        check_id: "OUTPUT_SHAPE",
        status: "PASS",
        detail: "Required structured fields are present and unsupported fields are absent."
      },
      {
        check_id: "EVIDENCE_CITATIONS",
        status: "PASS",
        detail: `${evidenceReferenceCount} evidence reference${evidenceReferenceCount === 1 ? "" : "s"} resolved to persisted evidence.`
      },
      {
        check_id: "RULE_CITATIONS",
        status: "PASS",
        detail: `${ruleReferenceCount} rule reference${ruleReferenceCount === 1 ? "" : "s"} resolved to deterministic rule results.`
      },
      {
        check_id: "RECOMMENDATION_GATE",
        status: "PASS",
        detail: gateActive
          ? "The recommendation respects the active hard gate and does not approve the case."
          : "The recommendation is allowed by the current deterministic case state."
      },
      {
        check_id: "HUMAN_AUTHORITY",
        status: "PASS",
        detail: "No human decision or decision event was accepted from case-writer output."
      }
    ],
    rejected_attempts: rejected_attempts.map((message, index) => ({
      attempt: index + 1,
      reason: message
    }))
  };
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
