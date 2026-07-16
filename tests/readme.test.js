import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readme = await readFile("README.md", "utf8");

test("README presents product thesis and judge walkthrough", () => {
  assert.match(readme, /Where AI prepares decisions without owning them/);
  assert.match(readme, /Truth Lane\s*→\s*Case Writing Lane\s*→\s*Decision Lane/);
  assert.match(readme, /The Problem/);
  assert.match(readme, /The Decision/);
  assert.match(readme, /Walkthrough/);
  assert.match(readme, /npm start/);
  assert.match(readme, /npm test/);
});

test("README avoids domain pivot branding", () => {
  assert.equal(readme.includes(["Ship", "Check"].join("")), false);
  assert.equal(readme.includes(["Submission", " Auditor"].join("")), false);
});
