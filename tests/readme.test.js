import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readme = await readFile("README.md", "utf8");

test("README presents product thesis and judge walkthrough", () => {
  assert.match(readme, /Where AI prepares decisions without owning them/);
  assert.match(readme, /Truth Lane[\s\S]*Grounded Case Writer[\s\S]*Human Decision[\s\S]*Decision Handoff[\s\S]*Pack Back[\s\S]*Versioned DecisionCase/);
  assert.match(readme, /The Problem/);
  assert.match(readme, /The Decision/);
  assert.match(readme, /Walkthrough/);
  assert.match(readme, /human_decision_events.*canonical source of truth/);
  assert.match(readme, /Derived projections never become independent sources of truth/);
  assert.match(readme, /decision-story/);
  assert.match(readme, /npm start/);
  assert.match(readme, /npm test/);
});

test("README avoids domain pivot branding", () => {
  assert.equal(readme.includes(["Ship", "Check"].join("")), false);
  assert.equal(readme.includes(["Submission", " Auditor"].join("")), false);
});
