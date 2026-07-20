import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { URL } from "node:url";
import { fileURLToPath } from "node:url";
import {
  deriveCaseReadiness,
  deriveDecisionStory,
  deriveDecisionTimeline,
  deriveTraceabilityMap,
  loadReadinessPolicy
} from "../../../packages/case-insights/src/index.js";
import { writeGroundedCaseBrief } from "../../../packages/case-writer/src/index.js";
import { CaseStore } from "../../../packages/case-store/src/caseStore.js";
import { createHandoffArtifacts } from "../../../packages/handoff/src/handoffGenerator.js";
import { importPackBack, submitHumanDecision } from "../../../packages/human-decision/src/index.js";
import { importIntakePacket, listDemoIntakePackets } from "../../../packages/intake/src/index.js";
import { runDeterministicReview } from "../../../packages/rules-engine/src/index.js";
import { getModelConfig } from "../../../src/config/modelConfig.js";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const HUMAN_DECISION_PATCH_FIELDS = new Set(["human_decision", "human_decision_events"]);
const TERMINAL_DECISION_STATUSES = new Set(["APPROVED", "REJECTED", "CLOSED"]);

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

function sendDetailedError(res, statusCode, error) {
  sendJson(res, statusCode, { error: error.message || "Request failed", details: error.details });
}

async function sendStatic(res, pathname) {
  const fileName = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!/^(index\.html|app\.js|styles\.css)$/.test(fileName)) {
    return false;
  }
  const filePath = path.join(process.cwd(), "apps", "web", fileName);
  const body = await readFile(filePath);
  const type = fileName.endsWith(".js")
    ? "application/javascript; charset=utf-8"
    : fileName.endsWith(".css")
      ? "text/css; charset=utf-8"
      : "text/html; charset=utf-8";
  res.writeHead(200, {
    "content-type": type,
    "cache-control": "no-store"
  });
  res.end(body);
  return true;
}

function caseIdFromPath(pathname, suffix = "") {
  const pattern = suffix
    ? new RegExp(`^/cases/([^/]+)/${suffix}$`)
    : /^\/cases\/([^/]+)$/;
  const match = pathname.match(pattern);
  return match ? decodeURIComponent(match[1]) : null;
}

function assertNoHumanDecisionBypass(patch = {}) {
  for (const field of HUMAN_DECISION_PATCH_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      throw new Error(`${field} can only be changed through POST /cases/:caseId/decisions`);
    }
  }
  if (TERMINAL_DECISION_STATUSES.has(patch.status)) {
    throw new Error(`${patch.status} requires POST /cases/:caseId/decisions`);
  }
}

export async function handleRequest(req, res, store = new CaseStore(), { fetchImpl, modelEnv = process.env } = {}) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  try {
    if (req.method === "GET" && await sendStatic(res, pathname)) {
      return;
    }

    if (req.method === "GET" && pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        service: "klear-decision-room-api",
        phase: 4,
        model_config: getModelConfig()
      });
      return;
    }

    if (req.method === "GET" && pathname === "/cases") {
      const cases = await store.listCases();
      sendJson(res, 200, { cases });
      return;
    }

    if (req.method === "GET" && pathname === "/demo-intake-packets") {
      sendJson(res, 200, { packets: await listDemoIntakePackets() });
      return;
    }

    if (req.method === "POST" && pathname === "/intake-packets") {
      const body = await readJson(req);
      const result = await importIntakePacket(store, body);
      sendJson(res, 201, result);
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
      assertNoHumanDecisionBypass(body.patch || body);
      const decisionCase = await store.saveCase(caseId, body.patch || body, {
        actor: body.actor,
        note: body.note,
        source_event: body.source_event
      });
      sendJson(res, 200, { case: decisionCase });
      return;
    }

    const versionCaseId = caseIdFromPath(pathname, "versions");
    if (versionCaseId && req.method === "GET") {
      const versions = await store.listVersions(versionCaseId);
      sendJson(res, 200, { versions });
      return;
    }

    if (versionCaseId && req.method === "POST") {
      const body = await readJson(req);
      assertNoHumanDecisionBypass(body.patch || {});
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

    const decisionCaseId = caseIdFromPath(pathname, "decisions");
    if (decisionCaseId && req.method === "POST") {
      const body = await readJson(req);
      const result = await submitHumanDecision(store, decisionCaseId, body);
      sendJson(res, 201, {
        case: result.case,
        decision_event: result.decision_event,
        handoff: createHandoffArtifacts(result.case)
      });
      return;
    }

    const handoffCaseId = caseIdFromPath(pathname, "handoff");
    if (handoffCaseId && req.method === "GET") {
      const decisionCase = await store.getCase(handoffCaseId);
      sendJson(res, 200, { handoff: createHandoffArtifacts(decisionCase) });
      return;
    }

    const packBackCaseId = caseIdFromPath(pathname, "pack-back");
    if (packBackCaseId && req.method === "POST") {
      const body = await readJson(req);
      const result = await importPackBack(store, packBackCaseId, body);
      const policy = await loadReadinessPolicy();
      sendJson(res, 201, {
        case: result.case,
        pack_back: result.pack_back,
        decision_story: deriveDecisionStory(result.case, policy)
      });
      return;
    }

    const reviewCaseId = caseIdFromPath(pathname, "deterministic-review");
    if (reviewCaseId && req.method === "POST") {
      const decisionCase = await runDeterministicReview(store, reviewCaseId);
      const policy = await loadReadinessPolicy();
      sendJson(res, 200, {
        case: decisionCase,
        deterministic_review: {
          model_called: false,
          rule_count: decisionCase.rule_results.length,
          evidence_count: decisionCase.evidence.length,
          unknown_count: decisionCase.unknowns.length,
          readiness: deriveCaseReadiness(decisionCase, policy)
        }
      });
      return;
    }

    const caseBriefCaseId = caseIdFromPath(pathname, "case-brief");
    if (caseBriefCaseId && req.method === "POST") {
      const body = await readJson(req);
      const hasRequestKey = Boolean(body.api_key);
      if (hasRequestKey && !modelEnv.KLEAR_MODEL_ID) {
        throw new Error("Live case writer is not configured on this deployment");
      }
      const env = {
        ...modelEnv,
        OPENAI_API_KEY: body.api_key || modelEnv.OPENAI_API_KEY,
        KLEAR_MODEL_ID: modelEnv.KLEAR_MODEL_ID
      };
      const result = await writeGroundedCaseBrief(store, caseBriefCaseId, {
        env,
        fetchImpl,
        allowFallback: !hasRequestKey
      });
      sendJson(res, 200, {
        case: result.case,
        case_writer: {
          mode: result.writer.mode,
          model_called: result.writer.model_called,
          model_id: result.case.ai_case_brief.model_id || null
        }
      });
      return;
    }

    const readinessCaseId = caseIdFromPath(pathname, "readiness");
    if (readinessCaseId && req.method === "GET") {
      const decisionCase = await store.getCase(readinessCaseId);
      const policy = await loadReadinessPolicy();
      sendJson(res, 200, { readiness: deriveCaseReadiness(decisionCase, policy) });
      return;
    }

    const traceabilityCaseId = caseIdFromPath(pathname, "traceability");
    if (traceabilityCaseId && req.method === "GET") {
      const decisionCase = await store.getCase(traceabilityCaseId);
      sendJson(res, 200, { traceability: deriveTraceabilityMap(decisionCase) });
      return;
    }

    const timelineCaseId = caseIdFromPath(pathname, "timeline");
    if (timelineCaseId && req.method === "GET") {
      const decisionCase = await store.getCase(timelineCaseId);
      sendJson(res, 200, { timeline: deriveDecisionTimeline(decisionCase) });
      return;
    }

    const storyCaseId = caseIdFromPath(pathname, "decision-story");
    if (storyCaseId && req.method === "GET") {
      const decisionCase = await store.getCase(storyCaseId);
      const policy = await loadReadinessPolicy();
      sendJson(res, 200, { decision_story: deriveDecisionStory(decisionCase, policy) });
      return;
    }

    sendError(res, 404, "Not found");
  } catch (error) {
    const statusCode = error.statusCode || (error.code === "ENOENT" ? 404 : 400);
    sendDetailedError(res, statusCode, error);
  }
}

export function createServer({ caseStore = new CaseStore() } = {}) {
  return http.createServer((req, res) => handleRequest(req, res, caseStore));
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  createServer().listen(PORT, HOST, () => {
    console.log(`KLEAR Decision Room API listening on http://${HOST}:${PORT}`);
  });
}
