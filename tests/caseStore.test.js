import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CaseStore } from "../packages/case-store/src/caseStore.js";
import { CaseStatus, OwnerRole, createOwner } from "../packages/case-schema/src/index.js";

test("creates and retrieves a decision case", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "klear-case-store-"));
  const store = new CaseStore({ dataDir });
  const created = await store.createCase({
    requester: createOwner(OwnerRole.REQUESTER, "Requester One")
  });

  assert.match(created.case_id, /^CASE-\d{4}-0001$/);
  assert.equal(created.version, 1);
  assert.equal(created.status, CaseStatus.DRAFT);

  const retrieved = await store.getCase(created.case_id);
  assert.equal(retrieved.case_id, created.case_id);
  assert.equal(retrieved.requester.name, "Requester One");
});

test("versions a decision case with explicit history", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "klear-case-store-"));
  const store = new CaseStore({ dataDir });
  const created = await store.createCase();

  const versioned = await store.versionCase(
    created.case_id,
    {
      status: CaseStatus.UNDER_REVIEW,
      facts: [{ fact_id: "FACT-001", field: "invoice_number", value: "INV-100" }]
    },
    {
      actor: createOwner(OwnerRole.SYSTEM, "Phase 1 Test"),
      note: "Opened case for review.",
      source_event: "test"
    }
  );

  assert.equal(versioned.version, 2);
  assert.equal(versioned.status, CaseStatus.UNDER_REVIEW);
  assert.equal(versioned.history.at(-1).previous_status, CaseStatus.DRAFT);
  assert.equal(versioned.history.at(-1).new_status, CaseStatus.UNDER_REVIEW);
  assert.deepEqual(versioned.history.at(-1).changed_fields.sort(), ["facts", "status"]);
});
