import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CaseStatus, OwnerRole, createDecisionCase, createOwner } from "../packages/case-schema/src/index.js";
import { assertDeterministicStatus, buildReviewedCasePatch, runDeterministicReview } from "../packages/rules-engine/src/index.js";
import { CaseStore } from "../packages/case-store/src/caseStore.js";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assertHumanDecisionUnchanged } from "./helpers/assertions.js";

const [policy, vendor_master, paid_ledger, demoInvoices] = await Promise.all([
  readJson("data/policies/finance-approval-policy.json"),
  readJson("data/demo/vendor-master.json"),
  readJson("data/demo/paid-ledger.json"),
  readJson("data/demo/demo-invoices.json")
]);

function readJson(path) {
  return readFile(path, "utf8").then(JSON.parse);
}

function caseForScenario(scenarioId) {
  const scenario = demoInvoices.find((item) => item.scenario_id === scenarioId);
  assert.ok(scenario, `scenario exists: ${scenarioId}`);
  return createDecisionCase({
    case_id: `CASE-2026-${scenarioId.replace("SCN-", "")}`,
    requester: createOwner(OwnerRole.REQUESTER, "Scenario Requester"),
    input_records: [
      {
        input_id: `INPUT-${scenario.scenario_id}`,
        source_type: "INVOICE",
        source_name: scenario.source_name,
        received_at: "2026-07-16T00:00:00.000Z",
        payload: scenario.invoice
      },
      ...(scenario.supporting_documents || []).map((document, index) => ({
        input_id: `INPUT-${scenario.scenario_id}-SUPPORT-${index + 1}`,
        source_type: "SUPPORTING_DOCUMENT",
        source_name: document.source_name,
        received_at: "2026-07-16T00:00:00.000Z",
        payload: document
      }))
    ]
  });
}

function reviewScenario(scenarioId) {
  return buildReviewedCasePatch(caseForScenario(scenarioId), {
    policy,
    vendor_master,
    paid_ledger
  });
}

function ruleById(review, ruleId) {
  const rule = review.rule_results.find((item) => item.rule_id === ruleId);
  assert.ok(rule, `rule exists: ${ruleId}`);
  return rule;
}

function assertCitedOrUnavailable(rule) {
  if (["FAIL", "WARNING", "UNKNOWN"].includes(rule.status)) {
    assert.ok(
      rule.evidence_ids.length > 0 || rule.details.evidence_unavailable_reason,
      `${rule.rule_id} must cite evidence or explain unavailable evidence`
    );
  }
}

test("clean invoice normalizes facts and passes deterministic rules", () => {
  const review = reviewScenario("SCN-CLEAN");
  assert.equal(review.status, CaseStatus.READY_FOR_DECISION);
  assert.equal(review.facts.length, policy.required_invoice_fields.length);
  assert.equal(review.unknowns.length, 0);
  assert.equal(review.rule_results.every((rule) => ["PASS", "NOT_APPLICABLE"].includes(rule.status)), true);
  assert.equal(ruleById(review, "R-001").status, "PASS");
  assert.equal(ruleById(review, "R-002").status, "PASS");
  assert.equal(ruleById(review, "R-003").status, "PASS");
  assert.equal(ruleById(review, "R-004").status, "PASS");
  assert.equal(ruleById(review, "R-005").status, "PASS");
  assert.equal(ruleById(review, "R-006").status, "PASS");
  assert.equal(ruleById(review, "R-007").status, "NOT_APPLICABLE");
});

test("duplicate invoice fails duplicate and previous-payment rules", () => {
  const review = reviewScenario("SCN-DUPLICATE");
  assert.equal(review.status, CaseStatus.EVIDENCE_REQUIRED);
  assert.equal(ruleById(review, "R-001").status, "FAIL");
  assert.equal(ruleById(review, "R-001").details.matched_payment_id, "PAY-2026-00418");
  assert.equal(ruleById(review, "R-006").status, "FAIL");
  assert.equal(ruleById(review, "R-006").details.payment_status, "PAID");
});

test("bank mismatch requires verification and does not label fraud", () => {
  const review = reviewScenario("SCN-BANK-MISMATCH");
  const bankRule = ruleById(review, "R-003");
  assert.equal(review.status, CaseStatus.EVIDENCE_REQUIRED);
  assert.equal(bankRule.status, "FAIL");
  assert.match(bankRule.summary, /Verification required/);
  assert.doesNotMatch(`${bankRule.summary} ${JSON.stringify(bankRule.details)}`, /fraud/i);
  assert.equal(ruleById(review, "R-007").status, "PASS");
});

test("missing vendor preserves UNKNOWN explicitly", () => {
  const review = reviewScenario("SCN-MISSING-VENDOR");
  assert.equal(review.status, CaseStatus.EVIDENCE_REQUIRED);
  assert.equal(ruleById(review, "R-002").status, "UNKNOWN");
  assert.equal(ruleById(review, "R-003").status, "UNKNOWN");
  assert.ok(review.unknowns.some((item) => item.field === "vendor_id"));
  assert.ok(review.unknowns.some((item) => item.unknown_id === "UNK-RULE-R-002"));
  assert.ok(review.unknowns.some((item) => item.unknown_id === "UNK-RULE-R-003"));
});

test("missing supporting evidence fails configurable support rule", () => {
  const review = reviewScenario("SCN-MISSING-SUPPORT");
  const supportRule = ruleById(review, "R-007");
  assert.equal(review.status, CaseStatus.EVIDENCE_REQUIRED);
  assert.equal(supportRule.status, "FAIL");
  assert.equal(supportRule.details.threshold, policy.supporting_evidence.required_over_total);
  assert.equal(supportRule.details.evidence_unavailable_reason, "No accepted supporting document attached.");
});

test("amount consistency rule fails invalid totals without relying on scenario identity", () => {
  const decisionCase = caseForScenario("SCN-CLEAN");
  decisionCase.input_records[0].payload.total = 9999;
  const review = buildReviewedCasePatch(decisionCase, {
    policy,
    vendor_master,
    paid_ledger
  });

  const amountRule = ruleById(review, "R-004");
  assert.equal(amountRule.status, "FAIL");
  assert.equal(amountRule.details.expected_total, 1339.2);
  assert.equal(amountRule.details.submitted_total, 9999);
});

test("every failing or unknown rule cites evidence or explains unavailable evidence", () => {
  for (const scenario of demoInvoices) {
    const review = reviewScenario(scenario.scenario_id);
    for (const rule of review.rule_results) {
      assertCitedOrUnavailable(rule);
    }
  }
});

test("all rule evidence IDs point to persisted evidence objects", () => {
  for (const scenario of demoInvoices) {
    const review = reviewScenario(scenario.scenario_id);
    const evidenceIds = new Set(review.evidence.map((item) => item.evidence_id));
    for (const rule of review.rule_results) {
      for (const evidenceId of rule.evidence_ids) {
        assert.ok(evidenceIds.has(evidenceId), `${scenario.scenario_id} ${rule.rule_id} missing ${evidenceId}`);
      }
    }
  }
});

test("deterministic review cannot transition into human-decision states", () => {
  for (const status of [CaseStatus.APPROVED, CaseStatus.REJECTED, CaseStatus.CLOSED]) {
    assert.throws(() => assertDeterministicStatus(status), /human decision event/);
  }
});

test("deterministic escalation requires explicit policy permission", () => {
  assert.throws(() => assertDeterministicStatus(CaseStatus.ESCALATED), /allow_deterministic_escalation/);
  assert.equal(
    assertDeterministicStatus(CaseStatus.ESCALATED, { allow_deterministic_escalation: true }),
    CaseStatus.ESCALATED
  );
});

test("deterministic review preserves existing human decision state", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "klear-review-"));
  const store = new CaseStore({ dataDir });
  const created = await store.createCase({
    ...caseForScenario("SCN-CLEAN"),
    human_decision: {
      decision: null,
      decided_by: null,
      decided_at: null,
      reason: "reserved for explicit human event"
    }
  });
  const reviewed = await runDeterministicReview(store, created.case_id);
  assertHumanDecisionUnchanged(created, reviewed);
});
