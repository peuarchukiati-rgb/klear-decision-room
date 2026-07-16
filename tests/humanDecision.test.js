import assert from "node:assert/strict";
import { readFile, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { deriveDecisionStory } from "../packages/case-insights/src/index.js";
import { CaseStore } from "../packages/case-store/src/caseStore.js";
import { OwnerRole, createOwner } from "../packages/case-schema/src/index.js";
import { createHandoffArtifacts } from "../packages/handoff/src/handoffGenerator.js";
import { importPackBack, submitHumanDecision } from "../packages/human-decision/src/index.js";
import { runDeterministicReview } from "../packages/rules-engine/src/index.js";
import { assertHumanDecisionUnchanged } from "./helpers/assertions.js";

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
    requester: createOwner(OwnerRole.REQUESTER, "Demo Requester"),
    current_owner: createOwner(OwnerRole.REVIEWER, "Finance Reviewer"),
    next_owner: createOwner(OwnerRole.REVIEWER, "Finance Reviewer"),
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
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "klear-human-decision-"));
  const store = new CaseStore({ dataDir });
  const created = await store.createCase(scenarioInput(scenarioId));
  const reviewed = await runDeterministicReview(store, created.case_id);
  return { store, created, reviewed };
}

const reviewer = createOwner(OwnerRole.REVIEWER, "Finance Reviewer");

test("human decision events are canonical and human_decision is latest snapshot", async () => {
  const { store, reviewed } = await reviewedScenario("SCN-CLEAN");

  const result = await submitHumanDecision(store, reviewed.case_id, {
    action: "APPROVE",
    reviewer,
    reason: "All deterministic checks passed and no unknowns remain.",
    timestamp: "2026-07-16T10:00:00.000Z"
  });

  assert.equal(result.case.status, "APPROVED");
  assert.equal(result.case.human_decision_events.length, 1);
  assert.equal(result.case.human_decision_events[0].decision_event_id, "HDEC-0001");
  assert.equal(result.case.human_decision.decision_event_id, "HDEC-0001");
  assert.equal(result.case.human_decision.decision, "APPROVE");
});

test("approve is blocked when readiness is false", async () => {
  const { store, reviewed } = await reviewedScenario("SCN-BANK-MISMATCH");

  await assert.rejects(
    submitHumanDecision(store, reviewed.case_id, {
      action: "APPROVE",
      reviewer,
      reason: "Attempting approval despite mismatch."
    }),
    /ready for decision/
  );
});

test("invalid human transitions require action-specific fields", async () => {
  const { store, reviewed } = await reviewedScenario("SCN-BANK-MISMATCH");

  await assert.rejects(
    submitHumanDecision(store, reviewed.case_id, {
      action: "REQUEST_EVIDENCE",
      reviewer,
      reason: "Need support."
    }),
    /required_evidence/
  );

  await assert.rejects(
    submitHumanDecision(store, reviewed.case_id, {
      action: "ESCALATE",
      reviewer,
      reason: "Needs a second owner."
    }),
    /escalation target/
  );
});

test("every human action creates immutable version snapshots and history", async () => {
  const { store, reviewed } = await reviewedScenario("SCN-CLEAN");

  const decided = await submitHumanDecision(store, reviewed.case_id, {
    action: "APPROVE",
    reviewer,
    reason: "Ready to pay."
  });
  const versionsAfterDecision = await store.listVersions(reviewed.case_id);
  const v2Snapshot = versionsAfterDecision.find((item) => item.version === reviewed.version).snapshot;

  await importPackBack(store, reviewed.case_id, {
    case_id: reviewed.case_id,
    source_case_version: decided.case.version,
    handoff_id: createHandoffArtifacts(decided.case).machine_readable.handoff_id,
    responding_actor: createOwner(OwnerRole.NEXT_OWNER, "Accounts Payable"),
    event_type: "ACTION_COMPLETED",
    completed_actions: ["Scheduled payment."],
    new_evidence: [],
    changed_fields: [],
    unresolved_items: [],
    note: "Payment scheduled."
  });

  const versions = await store.listVersions(reviewed.case_id);
  assert.deepEqual(versions.find((item) => item.version === reviewed.version).snapshot, v2Snapshot);
  assert.ok(versions.some((item) => item.snapshot.history.at(-1).source_event === "human_decision"));
  assert.ok(versions.some((item) => item.snapshot.history.at(-1).source_event === "pack_back"));
});

test("handoff lineage references latest case version and decision event", async () => {
  const { store, reviewed } = await reviewedScenario("SCN-CLEAN");
  const decided = await submitHumanDecision(store, reviewed.case_id, {
    action: "APPROVE",
    reviewer,
    reason: "Ready to pay."
  });
  const handoff = createHandoffArtifacts(decided.case, { generated_at: "2026-07-16T10:00:00.000Z" });

  assert.equal(handoff.machine_readable.generated_from_case_version, decided.case.version);
  assert.equal(handoff.machine_readable.generated_from_decision_event, "HDEC-0001");
  assert.match(handoff.machine_readable.handoff_id, /HANDOFF-CASE-\d{4}-0001-V3-HDEC-0001/);
  assert.ok(handoff.human_readable.includes("## Machine-readable Plane"));
});

test("pack-back rejects unsafe input and accepted updates derive a decision story", async () => {
  const { store, reviewed } = await reviewedScenario("SCN-BANK-MISMATCH");
  const requested = await submitHumanDecision(store, reviewed.case_id, {
    action: "REQUEST_EVIDENCE",
    reviewer,
    reason: "Bank account verification is required.",
    required_evidence: ["Vendor bank confirmation."]
  });
  const handoff = createHandoffArtifacts(requested.case);

  await assert.rejects(
    importPackBack(store, reviewed.case_id, {
      case_id: reviewed.case_id,
      source_case_version: requested.case.version - 1,
      responding_actor: createOwner(OwnerRole.NEXT_OWNER, "Vendor Desk"),
      event_type: "EVIDENCE_PROVIDED",
      human_decision: { decision: "APPROVE" }
    }),
    /Unsupported pack-back field/
  );

  await assert.rejects(
    importPackBack(store, reviewed.case_id, {
      case_id: "CASE-2099-9999",
      source_case_version: requested.case.version,
      responding_actor: createOwner(OwnerRole.NEXT_OWNER, "Vendor Desk"),
      event_type: "EVIDENCE_PROVIDED"
    }),
    /case_id must match/
  );

  await assert.rejects(
    importPackBack(store, reviewed.case_id, {
      case_id: reviewed.case_id,
      source_case_version: requested.case.version - 1,
      responding_actor: createOwner(OwnerRole.NEXT_OWNER, "Vendor Desk"),
      event_type: "EVIDENCE_PROVIDED"
    }),
    /stale/
  );

  const packed = await importPackBack(store, reviewed.case_id, {
    case_id: reviewed.case_id,
    source_case_version: requested.case.version,
    handoff_id: handoff.machine_readable.handoff_id,
    responding_actor: createOwner(OwnerRole.NEXT_OWNER, "Vendor Desk"),
    event_type: "EVIDENCE_PROVIDED",
    completed_actions: ["Uploaded vendor bank confirmation."],
    new_evidence: [
      {
        source_type: "SUPPORTING_DOCUMENT",
        source_name: "vendor-bank-confirmation.pdf",
        field: "bank_account_confirmation",
        value: "Vendor confirms updated account."
      }
    ],
    changed_fields: ["evidence"],
    unresolved_items: [],
    note: "Evidence added."
  });

  assert.equal(packed.case.version, requested.case.version + 1);
  assert.equal(packed.case.pack_back_events.length, 1);
  assertHumanDecisionUnchanged(requested.case, packed.case);

  const story = deriveDecisionStory(packed.case, policy);
  assert.equal(story.latest_decision.event.decision_event_id, "HDEC-0001");
  assert.equal(story.pack_back_events.length, 1);
  assert.ok(story.latest_handoff.machine_readable.evidence_ids.includes("EVID-PACK-BACK-1-VENDOR-BANK-CONFIRMATION-PDF"));
});
