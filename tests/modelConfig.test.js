import assert from "node:assert/strict";
import test from "node:test";
import { getModelConfig } from "../src/config/modelConfig.js";

test("bundled model config supports key-only reviewer setup", () => {
  assert.deepEqual(getModelConfig({}), {
    model_id: "gpt-5.6",
    model_ids: ["gpt-5.6", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-4o-mini"],
    source: "config/model.json"
  });
});

test("environment model config overrides the bundled default", () => {
  assert.deepEqual(getModelConfig({
    KLEAR_MODEL_ID: "deployment-model",
    KLEAR_MODEL_FALLBACK_IDS: "fallback-a, fallback-b"
  }), {
    model_id: "deployment-model",
    model_ids: ["deployment-model", "fallback-a", "fallback-b"],
    source: "KLEAR_MODEL_ID"
  });
});

test("deployment can disable compatibility fallbacks explicitly", () => {
  assert.deepEqual(getModelConfig({
    KLEAR_MODEL_ID: "deployment-model",
    KLEAR_MODEL_FALLBACK_IDS: ""
  }).model_ids, ["deployment-model"]);
});
