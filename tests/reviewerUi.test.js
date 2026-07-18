import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("static reviewer UI exposes Phase 4 operational panels", async () => {
  const html = await readFile("apps/web/index.html", "utf8");
  const js = await readFile("apps/web/app.js", "utf8");

  for (const label of [
    "Live Demo Mode",
    "Payment Review Simulation",
    "Check the case in detail. Prepare the evidence. Hand it to a human to decide.",
    "KLEAR verifies what is known, preserves what is unknown, and never owns the decision.",
    "Run Demo",
    "Run Bank-Mismatch Demo",
    "Every day, someone has to approve a payment before it goes out",
    "It's Friday, 4:15 PM. This invoice looks normal",
    "Continue to workspace",
    "Compare Good vs Messy Intake",
    "Finance Approval Workspace",
    "Approvals",
    "Next action",
    "What happened",
    "Files",
    "Handoff acknowledged, evidence pending",
    "Demo intake packet",
    "Import Intake",
    "Run Truth Review",
    "Try Blocked Approve",
    "Normalized Facts",
    "Evidence",
    "Decision Timeline",
    "Record an explicit decision",
    "decision-handoff.md",
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
  assert.ok(js.includes("klear-case-brief/v1"));
  assert.ok(js.includes("klear-handoff/v1"));
  assert.ok(js.includes("openArtifact"));
  assert.ok(js.includes("Unnamed vendor (see intake)"));
  assert.ok(js.includes("demo-cta-pulse"));
  assert.ok(js.includes("resetWorkspaceView"));
  assert.ok(js.includes("loadCases({ selectFirst: false })"));
  assert.ok(js.includes("INTRO_DISMISSED_KEY"));
  assert.ok(js.includes("/case-brief"));
  assert.ok(js.includes("/decisions"));
  assert.ok(js.includes("/pack-back"));
  assert.ok(js.includes("LIVE MODEL"));
  assert.ok(js.includes("beforeunload"));
  assert.match(js, /await api\(`\/cases\/\$\{selectedCaseId\}\/case-brief`[\s\S]*clearLiveModelApiKey\(form\)/);
  assert.ok(js.includes("confirm("));
});
