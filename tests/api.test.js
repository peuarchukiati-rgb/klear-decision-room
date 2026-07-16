import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { handleRequest } from "../apps/api/src/server.js";
import { CaseStore } from "../packages/case-store/src/caseStore.js";

async function request({ method, url, body, store }) {
  const req = Readable.from(body ? [JSON.stringify(body)] : []);
  req.method = method;
  req.url = url;
  req.headers = { host: "local.test", "content-type": "application/json" };

  const res = {
    statusCode: null,
    headers: null,
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(chunk) {
      this.body += chunk || "";
    }
  };

  await handleRequest(req, res, store);
  return {
    status: res.statusCode,
    json: () => JSON.parse(res.body)
  };
}

test("minimal API creates and versions a case", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "klear-api-"));
  const store = new CaseStore({ dataDir });

  const createdRes = await request({ method: "POST", url: "/cases", body: {}, store });
  assert.equal(createdRes.status, 201);
  const created = createdRes.json();
  const caseId = created.case.case_id;

  const versionedRes = await request({
    method: "POST",
    url: `/cases/${caseId}/versions`,
    body: {
      patch: { status: "UNDER_REVIEW" },
      note: "Moved into review."
    },
    store
  });
  assert.equal(versionedRes.status, 201);
  const versioned = versionedRes.json();
  assert.equal(versioned.case.version, 2);
  assert.equal(versioned.case.status, "UNDER_REVIEW");
  assert.equal(versioned.handoff.machine_readable.case_id, caseId);
});
