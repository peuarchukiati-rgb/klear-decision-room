import { readFileSync } from "node:fs";

const bundledConfig = JSON.parse(
  readFileSync(new URL("../../config/model.json", import.meta.url), "utf8")
);

export function getModelConfig(env = process.env) {
  const environmentModelId = env.KLEAR_MODEL_ID?.trim();
  return {
    model_id: environmentModelId || bundledConfig.model_id,
    source: environmentModelId ? "KLEAR_MODEL_ID" : "config/model.json"
  };
}
