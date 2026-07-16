import assert from "node:assert/strict";
import { readFile, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CaseStore } from "../packages/case-store/src/caseStore.js";
import { OwnerRole, createOwner } from "../packages/case-schema/src/index.js";
import { callOpenAiCaseWriter, validateCaseBriefOutput, writeGroundedCaseBrief } from "../packages/case-writer/src/index.js";
import { runDeterministicReview } from "../packages/rules-engine/src/index.js";
import { assertHumanDecisionUnchanged } from "./helpers/assertions.js";

const demoInvoices = await readJson("data/demo/demo-invoices.json");

function readJson(filePath) {
  return readFile(filePath, "utf8").then(JSON.parse);
}

function scenarioInput(scenarioId) {
  const scenario = demoInvoices.find((item) => item.scenario_id === scenarioId);
  assert.ok(scenario, `scenario exists: ${scenarioId}`);
  return {
    requester: createOwner(OwnerRole.REQUESTER, "Case Writer Test Requester"),
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

async function reviewedCase(scenarioId) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "klear-writer-"));
  const store = new CaseStore({ dataDir });
  const created = await store.createCase(scenarioInput(scenarioId));
  const reviewed = await runDeterministicReview(store, created.case_id);
  return { store, decisionCase: reviewed };
}

function validOutputFor(decisionCase, disposition = "REQUEST_EVIDENCE") {
  const rule = decisionCase.rule_results.find((item) => item.status === "FAIL" || item.status === "UNKNOWN")
    || decisionCase.rule_results[0];
  return {
    factual_summary: "The case brief uses only stored facts and deterministic rule results.",
    decision_context: "A reviewer must make the final decision.",
    risk_explanation: rule.summary,
    recommended_disposition: disposition,
    recommendation_reason: `Recommendation follows ${rule.rule_id}.`,
    missing_information_request: "Provide missing or verifying evidence if required.",
    next_owner_handoff: "Reviewer should inspect the cited rule and evidence before deciding.",
    citations: [
      {
        claim: rule.summary,
        evidence_ids: rule.evidence_ids,
        rule_ids: [rule.rule_id]
      }
    ],
    model_warnings: []
  };
}

test("case brief validator rejects invented evidence IDs", async () => {
  const { decisionCase } = await reviewedCase("SCN-DUPLICATE");
  const output = validOutputFor(decisionCase);
  output.citations[0].evidence_ids = ["EVID-DOES-NOT-EXIST"];

  assert.throws(
    () => validateCaseBriefOutput(decisionCase, output),
    /MODEL_OUTPUT_REJECTED.*unknown evidence_id/
  );
});

test("case brief validator rejects approval when hard gate is active", async () => {
  const { decisionCase } = await reviewedCase("SCN-BANK-MISMATCH");
  const output = validOutputFor(decisionCase, "APPROVE");

  assert.throws(
    () => validateCaseBriefOutput(decisionCase, output),
    /recommended_disposition is not allowed|APPROVE is forbidden/
  );
});

test("fallback case writer stores grounded citations and preserves human decision", async () => {
  const { store, decisionCase } = await reviewedCase("SCN-MISSING-VENDOR");
  const written = await writeGroundedCaseBrief(store, decisionCase.case_id, {
    env: {},
    allowFallback: true
  });

  assert.equal(written.writer.mode, "fallback");
  assert.equal(written.writer.model_called, false);
  assert.equal(written.case.version, 3);
  assertHumanDecisionUnchanged(decisionCase, written.case);
  assert.equal(written.case.ai_case_brief.writer_mode, "fallback");
  assert.ok(written.case.ai_case_brief.citations[0].rule_ids.length > 0);
  assert.ok(written.case.ai_case_brief.model_warnings.includes("FALLBACK_TEMPLATE_USED"));
});

test("provided model output is validated before storing", async () => {
  const { store, decisionCase } = await reviewedCase("SCN-DUPLICATE");
  const written = await writeGroundedCaseBrief(store, decisionCase.case_id, {
    env: { KLEAR_MODEL_ID: "configured-model" },
    modelOutput: validOutputFor(decisionCase),
    allowFallback: false
  });

  assert.equal(written.writer.mode, "provided_output");
  assert.equal(written.case.ai_case_brief.recommended_disposition, "REQUEST_EVIDENCE");
  assertHumanDecisionUnchanged(decisionCase, written.case);
});

test("case writer rejects model output attempting to mutate human decision", async () => {
  const { decisionCase } = await reviewedCase("SCN-DUPLICATE");
  const output = {
    ...validOutputFor(decisionCase),
    human_decision: {
      decision: "APPROVE",
      decided_by: "AI",
      decided_at: "2026-07-16T00:00:00.000Z",
      reason: "not allowed"
    }
  };

  assert.throws(
    () => validateCaseBriefOutput(decisionCase, output),
    /MODEL_OUTPUT_REJECTED.*unsupported field: human_decision/
  );
});

test("OpenAI client sends configured model id without source hardcoding", async () => {
  const calls = [];
  const output = {
    factual_summary: "summary",
    decision_context: "context",
    risk_explanation: "risk",
    recommended_disposition: "HOLD",
    recommendation_reason: "reason",
    missing_information_request: "missing",
    next_owner_handoff: "handoff",
    citations: [],
    model_warnings: []
  };
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () => ({ output_text: JSON.stringify(output) })
    };
  };

  const parsed = await callOpenAiCaseWriter({
    model_id: "env-configured-case-writer",
    api_key: "test-key",
    messages: [{ role: "user", content: "case" }],
    fetchImpl
  });

  assert.equal(parsed.recommended_disposition, "HOLD");
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.model, "env-configured-case-writer");
  assert.equal(body.text.format.strict, true);
});
