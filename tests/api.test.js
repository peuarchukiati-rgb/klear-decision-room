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
