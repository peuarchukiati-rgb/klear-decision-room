import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("static reviewer UI exposes Phase 4 operational panels", async () => {
  const html = await readFile("apps/web/index.html", "utf8");
  const js = await readFile("apps/web/app.js", "utf8");

  for (const label of [
    "Live Demo Mode",
    "Payment Review Simulation",
    "Start Bank-Mismatch Demo",
    "Compare Good vs Messy Intake",
    "Reviewer Objective",
    "Proof Target",
    "Handoff acknowledged, evidence pending",
    "Demo intake packet",
    "Import Intake",
    "Run Truth Review",
    "Try Blocked Approve",
    "Case Inbox",
    "Normalized Facts",
    "Evidence",
    "Decision Timeline",
    "Human Decision",
    "Decision Handoff",
    "Pack Back",
    "API Key",
    "Model ID"
  ]) {
    assert.ok(html.includes(label), `UI includes ${label}`);
  }

  assert.ok(js.includes("/decision-story"));
  assert.ok(js.includes("/demo-intake-packets"));
  assert.ok(js.includes("/intake-packets"));
  assert.ok(js.includes("DEMO-HANDOFF-SCN-BANK-MISMATCH"));
  assert.ok(js.includes("DEMO-MESSY-SCN-MISSING-VENDOR"));
  assert.ok(js.includes("Unsafe approval blocked"));
  assert.ok(js.includes("payment remains blocked"));
  assert.ok(js.includes("/case-brief"));
  assert.ok(js.includes("/decisions"));
  assert.ok(js.includes("/pack-back"));
  assert.ok(js.includes("LIVE MODEL"));
  assert.ok(js.includes("beforeunload"));
  assert.ok(js.includes("confirm("));
});
