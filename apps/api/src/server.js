import http from "node:http";
import { URL } from "node:url";
import { CaseStore } from "../../../packages/case-store/src/caseStore.js";
import { createHandoffArtifacts } from "../../../packages/handoff/src/handoffGenerator.js";
import { runDeterministicReview } from "../../../packages/rules-engine/src/index.js";
import { getModelConfig } from "../../../src/config/modelConfig.js";

const PORT = Number(process.env.PORT || 8787);
async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(`${payload}\n`);
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

function caseIdFromPath(pathname, suffix = "") {
  const pattern = suffix
    ? new RegExp(`^/cases/([^/]+)/${suffix}$`)
    : /^\/cases\/([^/]+)$/;
  const match = pathname.match(pattern);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function handleRequest(req, res, store = new CaseStore()) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  try {
    if (req.method === "GET" && pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        service: "klear-decision-room-api",
        phase: 2,
        model_config: getModelConfig()
      });
      return;
    }

    if (req.method === "GET" && pathname === "/cases") {
      const cases = await store.listCases();
      sendJson(res, 200, { cases });
      return;
    }

    if (req.method === "POST" && pathname === "/cases") {
      const body = await readJson(req);
      const decisionCase = await store.createCase(body);
      sendJson(res, 201, { case: decisionCase });
      return;
    }

    const caseId = caseIdFromPath(pathname);
    if (caseId && req.method === "GET") {
      const decisionCase = await store.getCase(caseId);
      sendJson(res, 200, { case: decisionCase });
      return;
    }

    if (caseId && req.method === "PUT") {
      const body = await readJson(req);
      const decisionCase = await store.saveCase(caseId, body.patch || body, {
        actor: body.actor,
        note: body.note,
        source_event: body.source_event
      });
      sendJson(res, 200, { case: decisionCase });
      return;
    }

    const versionCaseId = caseIdFromPath(pathname, "versions");
    if (versionCaseId && req.method === "POST") {
      const body = await readJson(req);
      const decisionCase = await store.versionCase(versionCaseId, body.patch || {}, {
        actor: body.actor,
        change_type: body.change_type,
        note: body.note,
        source_event: body.source_event
      });
      sendJson(res, 201, {
        case: decisionCase,
        handoff: createHandoffArtifacts(decisionCase)
      });
      return;
    }

    const reviewCaseId = caseIdFromPath(pathname, "deterministic-review");
    if (reviewCaseId && req.method === "POST") {
      const decisionCase = await runDeterministicReview(store, reviewCaseId);
      sendJson(res, 200, {
        case: decisionCase,
        deterministic_review: {
          model_called: false,
          rule_count: decisionCase.rule_results.length,
          evidence_count: decisionCase.evidence.length,
          unknown_count: decisionCase.unknowns.length
        }
      });
      return;
    }

    sendError(res, 404, "Not found");
  } catch (error) {
    const statusCode = error.code === "ENOENT" ? 404 : 400;
    sendError(res, statusCode, error.message || "Request failed");
  }
}

export function createServer({ caseStore = new CaseStore() } = {}) {
  return http.createServer((req, res) => handleRequest(req, res, caseStore));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer().listen(PORT, () => {
    console.log(`KLEAR Decision Room API listening on http://127.0.0.1:${PORT}`);
  });
}
