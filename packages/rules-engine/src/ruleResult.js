import { RuleResultStatus } from "../../case-schema/src/index.js";

export function ruleResult({
  rule_id,
  rule_name,
  status = RuleResultStatus.NOT_APPLICABLE,
  severity = "LOW",
  summary,
  evidence_ids = [],
  details = {},
  recommended_gate = "CONTINUE"
}) {
  if (
    [RuleResultStatus.FAIL, RuleResultStatus.WARNING, RuleResultStatus.UNKNOWN].includes(status) &&
    evidence_ids.length === 0 &&
    !details.evidence_unavailable_reason
  ) {
    throw new Error(`${rule_id} must reference evidence or record why evidence is unavailable`);
  }

  return {
    rule_id,
    rule_name,
    status,
    severity,
    summary,
    evidence_ids,
    details,
    recommended_gate
  };
}
