import assert from "node:assert/strict";
import { readFile, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writeGroundedCaseBrief } from "../packages/case-writer/src/index.js";
import { CaseStore } from "../packages/case-store/src/caseStore.js";
import { deriveCaseReadiness, deriveDecisionTimeline, deriveTraceabilityMap } from "../packages/case-insights/src/index.js";
import { OwnerRole, createOwner } from "../packages/case-schema/src/index.js";
import { runDeterministicReview } from "../packages/rules-engine/src/index.js";

const [policy, demoInvoices] = await Promise.all([
  readJson("data/policies/finance-approval-policy.json"),
  readJson("data/demo/demo-invoices.json")
]);

function readJson(filePath) {
  return readFile(filePath, "utf8").then(JSON.parse);
}

function scenarioInput(scenarioId) {
  const scenario = demoInvoices.find((item) => item.scenario_id === scenarioId);
  assert.ok(scenario, `scenario exists: ${scenarioId}`);
  return {
    requester: createOwner(OwnerRole.REQUESTER, "Insights Test Requester"),
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
  };
}

async function reviewedScenario(scenarioId) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "klear-insights-"));
  const store = new CaseStore({ dataDir });
  const created = await store.createCase(scenarioInput(scenarioId));
  const reviewed = await runDeterministicReview(store, created.case_id);
  return { store, reviewed };
}

test("case readiness summarizes clean scenario as ready for decision", async () => {
  const { reviewed } = await reviewedScenario("SCN-CLEAN");
  const readiness = deriveCaseReadiness(reviewed, policy);

  assert.equal(readiness.evidence_completeness_percent, 100);
  assert.equal(readiness.policy_coverage_percent, 100);
  assert.equal(readiness.unknown_count, 0);
  assert.equal(readiness.blocking_rule_count, 0);
  assert.equal(readiness.ready_for_decision, true);
});

test("case readiness summarizes blocking scenarios without model confidence", async () => {
  const duplicate = deriveCaseReadiness((await reviewedScenario("SCN-DUPLICATE")).reviewed, policy);
  const bankMismatch = deriveCaseReadiness((await reviewedScenario("SCN-BANK-MISMATCH")).reviewed, policy);
  const missingVendor = deriveCaseReadiness((await reviewedScenario("SCN-MISSING-VENDOR")).reviewed, policy);
  const missingSupport = deriveCaseReadiness((await reviewedScenario("SCN-MISSING-SUPPORT")).reviewed, policy);

  assert.equal(duplicate.ready_for_decision, false);
  assert.equal(duplicate.blocking_rule_count, 2);
  assert.equal(bankMismatch.blocking_rule_count, 1);
  assert.equal(missingVendor.ready_for_decision, false);
  assert.ok(missingVendor.unknown_count > 0);
  assert.ok(missingVendor.evidence_completeness_percent < 100);
  assert.equal(missingSupport.blocking_rule_count, 1);
  assert.ok(missingSupport.evidence_completeness_percent < 100);
});

test("traceability maps rule citations and reverse evidence links", async () => {
  const { reviewed } = await reviewedScenario("SCN-DUPLICATE");
  const traceability = deriveTraceabilityMap(reviewed);
  const duplicateRule = traceability.rules.find((rule) => rule.rule_id === "R-001");
  const paidLedgerEvidence = traceability.evidence.find((item) => item.evidence_id === "EVID-PAID-LEDGER-PAY-2026-00418");

  assert.ok(duplicateRule);
  assert.equal(duplicateRule.evidence.every((item) => item.found), true);
  assert.ok(paidLedgerEvidence.referenced_by_rule_ids.includes("R-001"));
  assert.ok(paidLedgerEvidence.referenced_by_rule_ids.includes("R-006"));
});

test("traceability records unavailable evidence reasons", async () => {
  const { reviewed } = await reviewedScenario("SCN-MISSING-SUPPORT");
  const traceability = deriveTraceabilityMap(reviewed);
  const supportRule = traceability.rules.find((rule) => rule.rule_id === "R-007");

  assert.equal(supportRule.status, "FAIL");
  assert.equal(supportRule.missing_evidence_reason, "No accepted supporting document attached.");
});

test("decision timeline projects history events in order", async () => {
  const { store, reviewed } = await reviewedScenario("SCN-BANK-MISMATCH");
  const written = await writeGroundedCaseBrief(store, reviewed.case_id, { env: {}, allowFallback: true });
  const timeline = deriveDecisionTimeline(written.case);

  assert.deepEqual(
    timeline.events.map((event) => event.label),
    ["Case created", "Deterministic review completed", "Grounded case brief prepared"]
  );
  assert.deepEqual(timeline.events.map((event) => event.sequence), [1, 2, 3]);
});
