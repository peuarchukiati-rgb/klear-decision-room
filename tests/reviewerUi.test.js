import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("static reviewer UI exposes Phase 4 operational panels", async () => {
  const html = await readFile("apps/web/index.html", "utf8");
  const js = await readFile("apps/web/app.js", "utf8");

  for (const label of [
    "Case Inbox",
    "Normalized Facts",
    "Evidence",
    "Decision Timeline",
    "Human Decision",
    "Decision Handoff",
    "Pack Back"
  ]) {
    assert.ok(html.includes(label), `UI includes ${label}`);
  }

  assert.ok(js.includes("/decision-story"));
  assert.ok(js.includes("/decisions"));
  assert.ok(js.includes("/pack-back"));
  assert.ok(js.includes("confirm("));
});
