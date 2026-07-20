import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CaseStore } from "../packages/case-store/src/caseStore.js";
import { seedDemoQueue } from "../scripts/seed-demo-queue.js";

test("curated demo queue seeds four distinct reviewed scenarios deterministically", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "klear-demo-queue-"));
  const seeded = await seedDemoQueue({ dataDir });
  const store = new CaseStore({ dataDir });
  const cases = await store.listCases();

  assert.deepEqual(seeded.map((item) => item.scenario_id), [
    "SCN-BANK-MISMATCH",
    "SCN-DUPLICATE",
    "SCN-MISSING-VENDOR",
    "SCN-CLEAN"
  ]);
  assert.deepEqual(seeded.map((item) => item.case_id.slice(-4)), ["0001", "0002", "0003", "0004"]);
  assert.deepEqual(seeded.map((item) => item.status), [
    "EVIDENCE_REQUIRED",
    "EVIDENCE_REQUIRED",
    "EVIDENCE_REQUIRED",
    "READY_FOR_DECISION"
  ]);
  assert.equal(cases.length, 4);
  assert.equal(cases[0].ai_case_brief.summary, "");
  assert.equal(cases[0].ai_case_brief.writer_mode, undefined);
  assert.equal(cases[2].facts.find((item) => item.field === "vendor_name")?.value, "Unmatched Field Services");
  assert.equal(cases[2].rule_results.find((item) => item.rule_id === "R-002")?.status, "UNKNOWN");
});
