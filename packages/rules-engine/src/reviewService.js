import { readFile } from "node:fs/promises";
import { CaseStatus, HistoryChangeType, OwnerRole, createOwner } from "../../case-schema/src/index.js";
import { normalizeInvoice } from "../../intake/src/invoiceNormalizer.js";
import { runFinanceRules } from "./financeRules.js";

const DEFAULT_POLICY_PATH = "data/policies/finance-approval-policy.json";
const DEFAULT_VENDOR_MASTER_PATH = "data/demo/vendor-master.json";
const DEFAULT_PAID_LEDGER_PATH = "data/demo/paid-ledger.json";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function loadDefaultReviewInputs({
  policyPath = DEFAULT_POLICY_PATH,
  vendorMasterPath = DEFAULT_VENDOR_MASTER_PATH,
  paidLedgerPath = DEFAULT_PAID_LEDGER_PATH
} = {}) {
  const [policy, vendor_master, paid_ledger] = await Promise.all([
    readJson(policyPath),
    readJson(vendorMasterPath),
    readJson(paidLedgerPath)
  ]);
  return { policy, vendor_master, paid_ledger };
}

export function deriveDeterministicStatus(ruleResults) {
  if (ruleResults.some((rule) => rule.status === "FAIL" || rule.status === "UNKNOWN")) {
    return CaseStatus.EVIDENCE_REQUIRED;
  }
  return CaseStatus.READY_FOR_DECISION;
}

export function buildReviewedCasePatch(decisionCase, reviewInputs) {
  const normalized = normalizeInvoice(decisionCase);
  const ruleRun = runFinanceRules({
    normalized_invoice: normalized.normalized_invoice,
    vendor_master: reviewInputs.vendor_master,
    paid_ledger: reviewInputs.paid_ledger,
    policy: reviewInputs.policy,
    evidence: normalized.evidence
  });

  return {
    status: deriveDeterministicStatus(ruleRun.rule_results),
    facts: normalized.facts,
    evidence: ruleRun.evidence,
    unknowns: mergeUnknowns(normalized.unknowns, ruleRun.rule_results),
    rule_results: ruleRun.rule_results
  };
}

function mergeUnknowns(normalizedUnknowns, ruleResults) {
  const byId = new Map(normalizedUnknowns.map((item) => [item.unknown_id, item]));
  for (const rule of ruleResults.filter((item) => item.status === "UNKNOWN")) {
    const unknown = {
      unknown_id: `UNK-RULE-${rule.rule_id}`,
      field: rule.rule_id,
      summary: rule.summary,
      evidence_ids: rule.evidence_ids,
      evidence_unavailable_reason: rule.details.evidence_unavailable_reason || null
    };
    byId.set(unknown.unknown_id, unknown);
  }
  return Array.from(byId.values()).sort((a, b) => a.unknown_id.localeCompare(b.unknown_id));
}

export async function runDeterministicReview(caseStore, caseId, reviewInputs = null) {
  const decisionCase = await caseStore.getCase(caseId);
  const inputs = reviewInputs || (await loadDefaultReviewInputs());
  const patch = buildReviewedCasePatch(decisionCase, inputs);
  return caseStore.versionCase(caseId, patch, {
    actor: createOwner(OwnerRole.SYSTEM, "Deterministic Review Engine"),
    change_type: HistoryChangeType.CASE_VERSIONED,
    note: "Ran deterministic review. No model was called and no human decision was changed.",
    source_event: "deterministic_review"
  });
}
