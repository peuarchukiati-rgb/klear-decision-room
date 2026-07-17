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

async function requestWithOptions({ method, url, body, store, options }) {
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

  await handleRequest(req, res, store, options);
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

test("API imports structured and messy intake packets as new decision cases", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "klear-api-"));
  const store = new CaseStore({ dataDir });

  const packetsRes = await request({ method: "GET", url: "/demo-intake-packets", store });
  assert.equal(packetsRes.status, 200);
  const packets = packetsRes.json().packets;
  const structured = packets.find((item) => item.packet_id === "DEMO-HANDOFF-SCN-CLEAN");
  const messy = packets.find((item) => item.packet_id === "DEMO-MESSY-SCN-MISSING-VENDOR");

  const structuredRes = await request({
    method: "POST",
    url: "/intake-packets",
    body: { packet: structured.packet },
    store
  });
  const messyRes = await request({
    method: "POST",
    url: "/intake-packets",
    body: { packet: messy.packet },
    store
  });

  assert.equal(structuredRes.status, 201);
  assert.equal(structuredRes.json().case.input_records[0].payload.invoice_number, "INV-88904");
  assert.equal(messyRes.status, 201);
  assert.equal(messyRes.json().case.input_records[0].payload.invoice_number, "UN-5510");
  assert.equal(messyRes.json().case.input_records[0].payload.vendor_id, "");
});

test("intake packet import rejects human decision bypass fields", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "klear-api-"));
  const store = new CaseStore({ dataDir });

  const res = await request({
    method: "POST",
    url: "/intake-packets",
    body: {
      packet: {
        packet_id: "BAD-HANDOFF",
        packet_type: "STRUCTURED_HANDOFF",
        human_decision_events: [],
        invoice: {
          invoice_number: "BAD-1"
        }
      }
    },
    store
  });

  assert.equal(res.status, 400);
  assert.match(res.json().error, /human_decision_events/);
});

test("API runs deterministic review without changing human decision", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "klear-api-"));
  const store = new CaseStore({ dataDir });
  const createdRes = await request({
    method: "POST",
    url: "/cases",
    body: {
      human_decision: {
        decision: null,
        decided_by: null,
        decided_at: null,
        reason: null
      },
      input_records: [
        {
          input_id: "INPUT-API-CLEAN",
          source_type: "INVOICE",
          source_name: "atlas-invoice-88904.pdf",
          received_at: "2026-07-16T00:00:00.000Z",
          payload: {
            invoice_number: "INV-88904",
            vendor_name: "Atlas Office Supply",
            vendor_id: "VEN-ATLAS-001",
            invoice_date: "2026-07-12",
            due_date: "2026-08-11",
            currency: "USD",
            subtotal: 1240,
            tax: 99.2,
            total: 1339.2,
            bank_name: "First Harbor Bank",
            bank_account: "1002458891",
            purchase_order: "PO-70018"
          }
        }
      ]
    },
    store
  });
  const created = createdRes.json();

  const reviewedRes = await request({
    method: "POST",
    url: `/cases/${created.case.case_id}/deterministic-review`,
    body: {},
    store
  });

  assert.equal(reviewedRes.status, 200);
  const reviewed = reviewedRes.json();
  assert.equal(reviewed.deterministic_review.model_called, false);
  assert.equal(reviewed.deterministic_review.readiness.ready_for_decision, true);
  assert.equal(reviewed.case.version, 2);
  assert.equal(reviewed.case.rule_results.length, 7);
  assert.equal(reviewed.case.human_decision.decision, null);
});

test("API writes fallback case brief without model involvement", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "klear-api-"));
  const store = new CaseStore({ dataDir });
  const createdRes = await request({
    method: "POST",
    url: "/cases",
    body: {
      input_records: [
        {
          input_id: "INPUT-API-BANK",
          source_type: "INVOICE",
          source_name: "nova-invoice-2291.pdf",
          received_at: "2026-07-16T00:00:00.000Z",
          payload: {
            invoice_number: "NE-2291",
            vendor_name: "Nova Equipment Services",
            vendor_id: "VEN-NOVA-002",
            invoice_date: "2026-07-10",
            due_date: "2026-08-09",
            currency: "USD",
            subtotal: 3900,
            tax: 312,
            total: 4212,
            bank_name: "Northstar Commercial",
            bank_account: "8811111111",
            purchase_order: "PO-70144"
          }
        },
        {
          input_id: "INPUT-API-BANK-SUPPORT",
          source_type: "SUPPORTING_DOCUMENT",
          source_name: "nova-po-70144.pdf",
          received_at: "2026-07-16T00:00:00.000Z",
          payload: {
            document_type: "PURCHASE_ORDER",
            reference: "PO-70144"
          }
        }
      ]
    },
    store
  });
  const created = createdRes.json();

  await request({
    method: "POST",
    url: `/cases/${created.case.case_id}/deterministic-review`,
    body: {},
    store
  });

  const briefRes = await request({
    method: "POST",
    url: `/cases/${created.case.case_id}/case-brief`,
    body: {},
    store
  });

  assert.equal(briefRes.status, 200);
  const brief = briefRes.json();
  assert.equal(brief.case_writer.model_called, false);
  assert.equal(brief.case.ai_case_brief.writer_mode, "fallback");
  assert.equal(brief.case.human_decision.decision, null);
});

test("API writes live case brief from per-request key and does not persist the key", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "klear-api-"));
  const store = new CaseStore({ dataDir });
  const createdRes = await request({
    method: "POST",
    url: "/cases",
    body: {
      input_records: [
        {
          input_id: "INPUT-API-LIVE",
          source_type: "INVOICE",
          source_name: "atlas-invoice-88904.pdf",
          received_at: "2026-07-16T00:00:00.000Z",
          payload: {
            invoice_number: "INV-88904",
            vendor_name: "Atlas Office Supply",
            vendor_id: "VEN-ATLAS-001",
            invoice_date: "2026-07-12",
            due_date: "2026-08-11",
            currency: "USD",
            subtotal: 1240,
            tax: 99.2,
            total: 1339.2,
            bank_name: "First Harbor Bank",
            bank_account: "1002458891",
            purchase_order: "PO-70018"
          }
        }
      ]
    },
    store
  });
  const caseId = createdRes.json().case.case_id;
  const reviewedRes = await request({
    method: "POST",
    url: `/cases/${caseId}/deterministic-review`,
    body: {},
    store
  });
  const reviewed = reviewedRes.json().case;
  const evidenceId = reviewed.evidence[0].evidence_id;
  const ruleId = reviewed.rule_results[0].rule_id;
  const liveKey = "test-live-model-key";

  const fetchImpl = async (_url, options) => {
    assert.equal(options.headers.authorization, `Bearer ${liveKey}`);
    const requestBody = JSON.parse(options.body);
    assert.equal(requestBody.model, "smallest-test-model");
    return {
      ok: true,
      status: 200,
      json: async () => ({
        output_text: JSON.stringify({
          factual_summary: "Live model summary grounded in stored case evidence.",
          decision_context: "The model writes only the brief.",
          risk_explanation: "No deterministic blocking rule is present.",
          recommended_disposition: "APPROVE",
          recommendation_reason: "All hard-gate checks passed.",
          missing_information_request: "",
          next_owner_handoff: "Reviewer may proceed to the human decision gate.",
          citations: [
            {
              claim: "Stored evidence supports the clean invoice review.",
              evidence_ids: [evidenceId],
              rule_ids: [ruleId]
            }
          ],
          model_warnings: []
        })
      }),
      text: async () => ""
    };
  };

  const briefRes = await requestWithOptions({
    method: "POST",
    url: `/cases/${caseId}/case-brief`,
    body: {
      api_key: liveKey,
      model_id: "smallest-test-model"
    },
    store,
    options: { fetchImpl }
  });

  assert.equal(briefRes.status, 200);
  const brief = briefRes.json();
  assert.equal(brief.case_writer.model_called, true);
  assert.equal(brief.case_writer.model_id, "smallest-test-model");
  assert.equal(brief.case.ai_case_brief.writer_mode, "model");

  const persisted = await store.getCase(caseId);
  const persistedText = JSON.stringify(persisted);
  const versionsText = JSON.stringify(await store.listVersions(caseId));
  assert.equal(persistedText.includes(liveKey), false);
  assert.equal(versionsText.includes(liveKey), false);
});

test("API exposes readiness, traceability, and timeline projections", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "klear-api-"));
  const store = new CaseStore({ dataDir });
  const createdRes = await request({
    method: "POST",
    url: "/cases",
    body: {
      input_records: [
        {
          input_id: "INPUT-API-DUP",
          source_type: "INVOICE",
          source_name: "atlas-invoice-88421-resubmitted.pdf",
          received_at: "2026-07-16T00:00:00.000Z",
          payload: {
            invoice_number: "INV-88421",
            vendor_name: "Atlas Office Supply",
            vendor_id: "VEN-ATLAS-001",
            invoice_date: "2026-06-20",
            due_date: "2026-07-20",
            currency: "USD",
            subtotal: 1370.6,
            tax: 109.65,
            total: 1480.25,
            bank_name: "First Harbor Bank",
            bank_account: "1002458891",
            purchase_order: "PO-69704"
          }
        }
      ]
    },
    store
  });
  const caseId = createdRes.json().case.case_id;

  await request({
    method: "POST",
    url: `/cases/${caseId}/deterministic-review`,
    body: {},
    store
  });

  const readinessRes = await request({ method: "GET", url: `/cases/${caseId}/readiness`, store });
  const traceabilityRes = await request({ method: "GET", url: `/cases/${caseId}/traceability`, store });
  const timelineRes = await request({ method: "GET", url: `/cases/${caseId}/timeline`, store });

  assert.equal(readinessRes.status, 200);
  assert.equal(readinessRes.json().readiness.ready_for_decision, false);
  assert.equal(traceabilityRes.status, 200);
  assert.ok(traceabilityRes.json().traceability.rules.some((rule) => rule.rule_id === "R-001"));
  assert.equal(timelineRes.status, 200);
  assert.deepEqual(
    timelineRes.json().timeline.events.map((event) => event.label),
    ["Case created", "Deterministic review completed"]
  );
});

test("API records human decisions, exposes versions, handoff, and decision story", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "klear-api-"));
  const store = new CaseStore({ dataDir });
  const createdRes = await request({
    method: "POST",
    url: "/cases",
    body: {
      input_records: [
        {
          input_id: "INPUT-API-CLEAN-DECISION",
          source_type: "INVOICE",
          source_name: "atlas-invoice-88904.pdf",
          received_at: "2026-07-16T00:00:00.000Z",
          payload: {
            invoice_number: "INV-88904",
            vendor_name: "Atlas Office Supply",
            vendor_id: "VEN-ATLAS-001",
            invoice_date: "2026-07-12",
            due_date: "2026-08-11",
            currency: "USD",
            subtotal: 1240,
            tax: 99.2,
            total: 1339.2,
            bank_name: "First Harbor Bank",
            bank_account: "1002458891",
            purchase_order: "PO-70018"
          }
        }
      ]
    },
    store
  });
  const caseId = createdRes.json().case.case_id;

  await request({ method: "POST", url: `/cases/${caseId}/deterministic-review`, body: {}, store });

  const decisionRes = await request({
    method: "POST",
    url: `/cases/${caseId}/decisions`,
    body: {
      action: "APPROVE",
      reviewer: { role: "REVIEWER", name: "API Reviewer" },
      reason: "Case is ready for payment."
    },
    store
  });
  assert.equal(decisionRes.status, 201);
  assert.equal(decisionRes.json().decision_event.decision_event_id, "HDEC-0001");

  const versionsRes = await request({ method: "GET", url: `/cases/${caseId}/versions`, store });
  const handoffRes = await request({ method: "GET", url: `/cases/${caseId}/handoff`, store });
  const storyRes = await request({ method: "GET", url: `/cases/${caseId}/decision-story`, store });

  assert.equal(versionsRes.status, 200);
  assert.ok(versionsRes.json().versions.length >= 3);
  assert.equal(handoffRes.status, 200);
  assert.equal(handoffRes.json().handoff.machine_readable.generated_from_decision_event, "HDEC-0001");
  assert.equal(storyRes.status, 200);
  assert.equal(storyRes.json().decision_story.latest_decision.event.decision_event_id, "HDEC-0001");
});

test("generic API routes cannot bypass explicit human decision service", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "klear-api-"));
  const store = new CaseStore({ dataDir });
  const createdRes = await request({ method: "POST", url: "/cases", body: {}, store });
  const caseId = createdRes.json().case.case_id;

  const putRes = await request({
    method: "PUT",
    url: `/cases/${caseId}`,
    body: {
      patch: {
        human_decision: {
          decision: "APPROVE",
          decided_by: { role: "REVIEWER", name: "Bypass" },
          decided_at: "2026-07-16T00:00:00.000Z",
          reason: "Bypass"
        }
      }
    },
    store
  });
  const versionRes = await request({
    method: "POST",
    url: `/cases/${caseId}/versions`,
    body: { patch: { status: "APPROVED" } },
    store
  });

  assert.equal(putRes.status, 400);
  assert.match(putRes.json().error, /POST \/cases\/:caseId\/decisions/);
  assert.equal(versionRes.status, 400);
  assert.match(versionRes.json().error, /requires POST/);
});
