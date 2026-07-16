export function getModelConfig(env = process.env) {
  return {
    model_id: env.KLEAR_MODEL_ID || "",
    source: "KLEAR_MODEL_ID"
  };
}
