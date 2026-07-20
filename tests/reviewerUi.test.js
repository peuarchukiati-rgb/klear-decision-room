import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("static reviewer UI exposes Phase 4 operational panels", async () => {
  const html = await readFile("apps/web/index.html", "utf8");
  const js = await readFile("apps/web/app.js", "utf8");
  const css = await readFile("apps/web/styles.css", "utf8");

  for (const label of [
    "Live Demo Mode",
    "Payment Review Simulation",
    "Ready to run.",
    "Check the case in detail. Prepare the evidence. Hand it to a human to decide.",
    "KLEAR verifies what is known, preserves what is unknown, and never owns the decision.",
    "Run Demo",
    "Connect OpenAI",
    "Connect OpenAI for the grounded case writer",
    "The truth layer remains deterministic. Human decision authority remains separate.",
    "Truth Layer",
    "Deterministic",
    "Case Writer",
    "OpenAI not connected",
    "Live case writer unavailable",
    "Human Decision",
    "Human only",
    "OpenAI has not prepared this case.",
    "Connect &amp; Run Live",
    "Run Offline Demo",
    "Run Bank-Mismatch Demo",
    "Every day, someone has to approve a payment before it goes out",
    "It's Friday, 4:15 PM. This invoice looks normal",
    "Continue to workspace",
    "Compare Good vs Messy Intake",
    "Finance Approval Workspace",
    "Approvals",
    "Next action",
    "What needs attention",
    "Validation receipt",
    "Checked before display",
    "Audit details",
    "Portable files",
    "Technical run log",
    "Handoff acknowledged, evidence pending",
    "Demo intake packet",
    "Import Intake",
    "Run Truth Review",
    "Try Blocked Approve",
    "Normalized facts",
    "Evidence",
    "Decision Timeline",
    "Record an explicit decision",
    "decision-handoff.md",
    "Pack Back",
    "API Key",
    "Offline can verify truth, but cannot complete the live decision journey."
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
  assert.ok(js.includes("OPENAI LIVE"));
  assert.ok(js.includes("openLiveModelSetup"));
  assert.ok(js.includes("prepareLiveBrief"));
  assert.ok(js.includes("runBankMismatchDemo"));
  assert.ok(js.includes("activateProofStep"));
  assert.ok(js.includes("failActiveProofStep"));
  assert.ok(js.includes("OpenAI is preparing a grounded brief from verified facts, evidence, and rule results..."));
  assert.ok(js.includes("renderValidationReceipt"));
  assert.ok(js.includes("OpenAI output rejected; deterministic fallback accepted"));
  assert.ok(js.includes("Compatible model selected automatically"));
  assert.ok(css.includes(".runway-activity.active"));
  assert.ok(css.includes(".step.active"));
  assert.ok(css.includes("button.is-busy"));
  assert.ok(html.includes("Request-scoped API key"));
  assert.ok(!html.includes("name=\"model_id\""));
  assert.ok(html.includes("<dialog id=\"model-dialog\""));
  assert.ok(html.includes("id=\"evidence-glance\""));
  assert.ok(html.includes("<details class=\"audit-details\">"));
  assert.ok(html.includes("<details class=\"proof-log\">"));
  assert.ok(js.includes("renderEvidenceGlance"));
  assert.ok(js.includes("Truth verification completed, but this decision journey remains incomplete."));
  assert.ok(js.includes("setProofStepLabel(2, \"OpenAI not connected\")"));
  assert.ok(js.includes("beforeunload"));
  assert.match(js, /runBankMismatchDemo\(\{ credentials: \{ \.\.\.liveModelCredentials \} \}\)[\s\S]*finally[\s\S]*clearLiveModelApiKey\(form\)/);
  assert.ok(js.includes("confirm("));
});
