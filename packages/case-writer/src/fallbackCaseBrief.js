import { hardGateActive } from "./promptBuilder.js";

function firstInvoiceFact(decisionCase, field) {
  return decisionCase.facts.find((fact) => fact.field === field)?.value ?? "unknown";
}

function firstRuleByStatus(decisionCase, statuses) {
  return decisionCase.rule_results.find((rule) => statuses.includes(rule.status));
}

export function createFallbackCaseBrief(decisionCase) {
  const blockingRule = firstRuleByStatus(decisionCase, ["FAIL", "UNKNOWN"]);
  const invoiceNumber = firstInvoiceFact(decisionCase, "invoice_number");
  const vendorName = firstInvoiceFact(decisionCase, "vendor_name");
  const total = firstInvoiceFact(decisionCase, "total");
  const recommendation = hardGateActive(decisionCase) ? "REQUEST_EVIDENCE" : "APPROVE";
  const primaryEvidenceIds = blockingRule?.evidence_ids?.length
    ? blockingRule.evidence_ids
    : decisionCase.evidence.slice(0, 2).map((item) => item.evidence_id);
  const primaryRuleIds = blockingRule ? [blockingRule.rule_id] : decisionCase.rule_results.slice(0, 2).map((rule) => rule.rule_id);

  return {
    factual_summary: `Invoice ${invoiceNumber} from ${vendorName} for ${total} was reviewed using deterministic case facts and rule results.`,
    decision_context: "This fallback brief was generated without a model call from stored case facts, evidence, and rule results.",
    risk_explanation: blockingRule
      ? blockingRule.summary
      : "No deterministic blocking rule is present.",
    recommended_disposition: recommendation,
    recommendation_reason: blockingRule
      ? `The case should remain gated because ${blockingRule.rule_id} is ${blockingRule.status}.`
      : "The deterministic review did not identify a blocking rule.",
    missing_information_request: decisionCase.unknowns.length
      ? decisionCase.unknowns.map((item) => item.summary).join(" ")
      : "",
    next_owner_handoff: blockingRule
      ? `Resolve ${blockingRule.rule_id}: ${blockingRule.summary}`
      : "Reviewer may proceed to the human decision gate.",
    citations: [
      {
        claim: blockingRule ? blockingRule.summary : "Deterministic review completed without a blocking rule.",
        evidence_ids: primaryEvidenceIds,
        rule_ids: primaryRuleIds
      }
    ],
    model_warnings: ["FALLBACK_TEMPLATE_USED"]
  };
}
