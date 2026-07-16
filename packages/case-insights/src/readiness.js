import { readFile } from "node:fs/promises";

const DEFAULT_POLICY_PATH = "data/policies/finance-approval-policy.json";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function loadReadinessPolicy(policyPath = DEFAULT_POLICY_PATH) {
  return readJson(policyPath);
}

function pct(numerator, denominator) {
  if (denominator === 0) {
    return 0;
  }
  return Math.round((numerator / denominator) * 100);
}

function blockingRules(decisionCase) {
  return decisionCase.rule_results.filter((rule) => {
    return rule.status === "FAIL" || rule.status === "UNKNOWN" || rule.recommended_gate === "HOLD";
  });
}

export function deriveCaseReadiness(decisionCase, policy) {
  const evidenceIds = new Set(decisionCase.evidence.map((item) => item.evidence_id));
  const ruleEvidenceRefs = decisionCase.rule_results.flatMap((rule) => rule.evidence_ids || []);
  const satisfiedEvidenceRefs = ruleEvidenceRefs.filter((evidenceId) => evidenceIds.has(evidenceId));
  const unavailableEvidenceCount = decisionCase.rule_results.filter((rule) => {
    return Boolean(rule.details?.evidence_unavailable_reason);
  }).length;
  const evidenceDenominator = ruleEvidenceRefs.length + unavailableEvidenceCount + decisionCase.unknowns.length;
  const policyRuleIds = new Set((policy.rules || []).map((rule) => rule.rule_id));
  const coveredPolicyRules = decisionCase.rule_results.filter((rule) => policyRuleIds.has(rule.rule_id));
  const blockers = blockingRules(decisionCase);
  const readyForDecision =
    decisionCase.status === "READY_FOR_DECISION" &&
    blockers.length === 0 &&
    decisionCase.unknowns.length === 0;
  const readinessReasons = [];

  if (decisionCase.rule_results.length === 0) {
    readinessReasons.push("Deterministic review has not been run.");
  }
  if (decisionCase.unknowns.length > 0) {
    readinessReasons.push(`${decisionCase.unknowns.length} unknown item(s) remain unresolved.`);
  }
  if (blockers.length > 0) {
    readinessReasons.push(`${blockers.length} blocking rule(s) require attention.`);
  }
  if (evidenceDenominator > 0 && satisfiedEvidenceRefs.length < evidenceDenominator) {
    readinessReasons.push("Some rule claims have missing or unavailable evidence.");
  }
  if (readyForDecision) {
    readinessReasons.push("Case has no blocking rules or unresolved unknowns.");
  }

  return {
    case_id: decisionCase.case_id,
    version: decisionCase.version,
    evidence_completeness_percent: pct(satisfiedEvidenceRefs.length, evidenceDenominator),
    policy_coverage_percent: pct(coveredPolicyRules.length, policyRuleIds.size),
    unknown_count: decisionCase.unknowns.length,
    blocking_rule_count: blockers.length,
    ready_for_decision: readyForDecision,
    readiness_reasons: readinessReasons
  };
}
