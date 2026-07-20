import { readFile } from "node:fs/promises";
import { HistoryChangeType, OwnerRole, createOwner } from "../../case-schema/src/index.js";
import { getModelConfig } from "../../../src/config/modelConfig.js";
import { buildCaseWriterMessages } from "./promptBuilder.js";
import { callOpenAiCaseWriter } from "./openAiCaseWriterClient.js";
import { createFallbackCaseBrief } from "./fallbackCaseBrief.js";
import {
  createCaseBriefValidationReceipt,
  toDecisionCaseBrief,
  validateCaseBriefOutput
} from "./caseBriefValidator.js";

const DEFAULT_POLICY_PATH = "data/policies/finance-approval-policy.json";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function isModelOutputRejection(error) {
  return error?.message?.startsWith("MODEL_OUTPUT_REJECTED:");
}

function isModelAccessFailure(error) {
  return error?.code === "model_not_found";
}

function messagesWithValidationFeedback(messages, error) {
  return [
    ...messages,
    {
      role: "system",
      content: [
        "Your previous output was rejected by the deterministic KLEAR validator.",
        error.message,
        "Correct only these validation failures. Use the original case data and return the required JSON schema without unsupported fields."
      ].join(" ")
    }
  ];
}

export async function writeGroundedCaseBrief(
  caseStore,
  caseId,
  {
    env = process.env,
    fetchImpl = fetch,
    policy = null,
    allowFallback = true,
    modelOutput = null,
    fallbackOnValidationFailure = true
  } = {}
) {
  const decisionCase = await caseStore.getCase(caseId);
  const activePolicy = policy || (await readJson(DEFAULT_POLICY_PATH));
  const messages = buildCaseWriterMessages(decisionCase, activePolicy);
  const modelConfig = getModelConfig(env);

  let output;
  let writerMode = "model";
  let modelCalled = false;
  let modelOutputAccepted = false;
  let attemptCount = 0;
  let fallbackUsed = false;
  let selectedModelId = null;
  const rejectedAttempts = [];
  const modelAccessFailures = [];
  if (modelOutput) {
    output = modelOutput;
    writerMode = "provided_output";
    validateCaseBriefOutput(decisionCase, output);
    modelOutputAccepted = true;
  } else if (env.OPENAI_API_KEY && modelConfig.model_id) {
    modelCalled = true;
    const modelIds = modelConfig.model_ids?.length ? modelConfig.model_ids : [modelConfig.model_id];
    for (const modelId of modelIds) {
      let attemptMessages = messages;
      let unavailable = false;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        attemptCount += 1;
        try {
          const candidate = await callOpenAiCaseWriter({
            model_id: modelId,
            api_key: env.OPENAI_API_KEY,
            messages: attemptMessages,
            fetchImpl
          });
          validateCaseBriefOutput(decisionCase, candidate);
          output = candidate;
          selectedModelId = modelId;
          modelOutputAccepted = true;
          break;
        } catch (error) {
          if (isModelAccessFailure(error)) {
            modelAccessFailures.push({ model_id: modelId, code: error.code });
            unavailable = true;
            break;
          }
          if (!isModelOutputRejection(error)) {
            throw error;
          }
          rejectedAttempts.push(error.message);
          if (attempt === 1) {
            attemptMessages = messagesWithValidationFeedback(messages, error);
          }
        }
      }
      if (output || rejectedAttempts.length === 2) break;
      if (!unavailable) break;
    }

    if (!output) {
      if (modelAccessFailures.length === modelIds.length) {
        throw new Error("No configured OpenAI model is available to this API project. Use a key with API model access or configure KLEAR_MODEL_ID.");
      }
      if (!fallbackOnValidationFailure) {
        throw new Error(rejectedAttempts[rejectedAttempts.length - 1]);
      }
      output = createFallbackCaseBrief(decisionCase);
      writerMode = "fallback_after_rejection";
      fallbackUsed = true;
    }
  } else if (allowFallback) {
    output = createFallbackCaseBrief(decisionCase);
    writerMode = "fallback";
    fallbackUsed = true;
  } else {
    throw new Error("Case writer requires OPENAI_API_KEY and KLEAR_MODEL_ID, or allowFallback=true");
  }

  validateCaseBriefOutput(decisionCase, output);
  const validation_receipt = createCaseBriefValidationReceipt(decisionCase, output, {
    model_called: modelCalled,
    model_output_accepted: modelOutputAccepted,
    attempt_count: attemptCount,
    rejected_attempts: rejectedAttempts,
    fallback_used: fallbackUsed,
    compatibility_model_used: Boolean(selectedModelId && selectedModelId !== modelConfig.model_id),
    model_access_failures: modelAccessFailures
  });
  const ai_case_brief = {
    ...toDecisionCaseBrief(output),
    writer_mode: writerMode,
    model_id_source: modelConfig.source,
    model_id: writerMode === "model" ? selectedModelId : null,
    validation_receipt
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
      model_called: modelCalled,
      model_output_accepted: modelOutputAccepted,
      compatibility_model_used: validation_receipt.compatibility_model_used,
      validation_receipt,
      prompt_messages: messages
    }
  };
}
