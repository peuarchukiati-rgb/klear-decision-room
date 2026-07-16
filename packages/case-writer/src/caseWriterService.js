import { readFile } from "node:fs/promises";
import { HistoryChangeType, OwnerRole, createOwner } from "../../case-schema/src/index.js";
import { getModelConfig } from "../../../src/config/modelConfig.js";
import { buildCaseWriterMessages } from "./promptBuilder.js";
import { callOpenAiCaseWriter } from "./openAiCaseWriterClient.js";
import { createFallbackCaseBrief } from "./fallbackCaseBrief.js";
import { toDecisionCaseBrief, validateCaseBriefOutput } from "./caseBriefValidator.js";

const DEFAULT_POLICY_PATH = "data/policies/finance-approval-policy.json";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function writeGroundedCaseBrief(
  caseStore,
  caseId,
  {
    env = process.env,
    fetchImpl = fetch,
    policy = null,
    allowFallback = true,
    modelOutput = null
  } = {}
) {
  const decisionCase = await caseStore.getCase(caseId);
  const activePolicy = policy || (await readJson(DEFAULT_POLICY_PATH));
  const messages = buildCaseWriterMessages(decisionCase, activePolicy);
  const modelConfig = getModelConfig(env);

  let output;
  let writerMode = "model";
  if (modelOutput) {
    output = modelOutput;
    writerMode = "provided_output";
  } else if (env.OPENAI_API_KEY && modelConfig.model_id) {
    output = await callOpenAiCaseWriter({
      model_id: modelConfig.model_id,
      api_key: env.OPENAI_API_KEY,
      messages,
      fetchImpl
    });
  } else if (allowFallback) {
    output = createFallbackCaseBrief(decisionCase);
    writerMode = "fallback";
  } else {
    throw new Error("Case writer requires OPENAI_API_KEY and KLEAR_MODEL_ID, or allowFallback=true");
  }

  validateCaseBriefOutput(decisionCase, output);
  const ai_case_brief = {
    ...toDecisionCaseBrief(output),
    writer_mode: writerMode,
    model_id_source: modelConfig.source,
    model_id: writerMode === "model" ? modelConfig.model_id : null
  };

  const updated = await caseStore.versionCase(
    caseId,
    { ai_case_brief },
    {
      actor: createOwner(OwnerRole.SYSTEM, "Grounded Case Writer"),
      change_type: HistoryChangeType.CASE_VERSIONED,
      note: `Prepared grounded case brief using ${writerMode}. Human decision unchanged.`,
      source_event: "grounded_case_writer"
    }
  );

  return {
    case: updated,
    writer: {
      mode: writerMode,
      model_called: writerMode === "model",
      prompt_messages: messages
    }
  };
}
