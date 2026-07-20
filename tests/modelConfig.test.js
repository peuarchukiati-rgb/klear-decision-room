import assert from "node:assert/strict";
import test from "node:test";
import { getModelConfig } from "../src/config/modelConfig.js";

test("bundled model config supports key-only reviewer setup", () => {
  assert.deepEqual(getModelConfig({}), {
    model_id: "gpt-5.6",
    source: "config/model.json"
  });
});

test("environment model config overrides the bundled default", () => {
  assert.deepEqual(getModelConfig({ KLEAR_MODEL_ID: "deployment-model" }), {
    model_id: "deployment-model",
    source: "KLEAR_MODEL_ID"
  });
});
