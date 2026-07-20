import { readFileSync } from "node:fs";

const bundledConfig = JSON.parse(
  readFileSync(new URL("../../config/model.json", import.meta.url), "utf8")
);

export function getModelConfig(env = process.env) {
  const environmentModelId = env.KLEAR_MODEL_ID?.trim();
  const hasEnvironmentFallbacks = Object.prototype.hasOwnProperty.call(env, "KLEAR_MODEL_FALLBACK_IDS");
  const fallbackModelIds = hasEnvironmentFallbacks
    ? String(env.KLEAR_MODEL_FALLBACK_IDS || "").split(",").map((item) => item.trim()).filter(Boolean)
    : bundledConfig.fallback_model_ids || [];
  const modelId = environmentModelId || bundledConfig.model_id;
  const modelIds = [...new Set([modelId, ...fallbackModelIds].filter(Boolean))];
  return {
    model_id: modelId,
    model_ids: modelIds,
    source: environmentModelId ? "KLEAR_MODEL_ID" : "config/model.json"
  };
}
