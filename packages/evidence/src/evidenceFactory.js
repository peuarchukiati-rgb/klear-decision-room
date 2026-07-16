import { EvidenceSourceType } from "../../case-schema/src/index.js";

function slug(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function evidenceId(...parts) {
  return `EVID-${parts.map(slug).filter(Boolean).join("-")}`;
}

export function createEvidence({
  evidence_id,
  source_type,
  source_name,
  source_location,
  field,
  value,
  confidence = value === null || value === undefined || value === "" ? 0 : 1,
  verified = false,
  created_at = new Date().toISOString()
}) {
  return {
    evidence_id,
    source_type,
    source_name,
    source_location,
    field,
    value: value ?? null,
    confidence,
    verified,
    created_at
  };
}

export function createInvoiceFieldEvidence(inputRecord, field, value) {
  return createEvidence({
    evidence_id: evidenceId("INVOICE", field),
    source_type: EvidenceSourceType.INVOICE,
    source_name: inputRecord.source_name,
    source_location: value === null || value === undefined || value === ""
      ? "structured invoice input: field unavailable"
      : `structured invoice input: ${field}`,
    field,
    value
  });
}

export function createVendorEvidence(vendor, field) {
  return createEvidence({
    evidence_id: evidenceId("VENDOR-MASTER", vendor.vendor_id, field),
    source_type: EvidenceSourceType.VENDOR_MASTER,
    source_name: "vendor-master.json",
    source_location: `vendor ${vendor.vendor_id}: ${field}`,
    field,
    value: vendor[field],
    verified: true
  });
}

export function createPaidLedgerEvidence(payment) {
  return createEvidence({
    evidence_id: evidenceId("PAID-LEDGER", payment.payment_id),
    source_type: EvidenceSourceType.PAID_LEDGER,
    source_name: "paid-ledger.json",
    source_location: `payment ${payment.payment_id}`,
    field: "payment_status",
    value: payment.status,
    verified: true
  });
}

export function createSupportingDocumentEvidence(inputRecord, index) {
  return createEvidence({
    evidence_id: evidenceId("SUPPORTING", index + 1, inputRecord.source_name),
    source_type: EvidenceSourceType.SUPPORTING_DOCUMENT,
    source_name: inputRecord.source_name,
    source_location: "supporting document input",
    field: inputRecord.payload?.document_type || "supporting_document",
    value: inputRecord.payload?.reference || inputRecord.source_name,
    verified: false
  });
}

export function upsertEvidence(existingEvidence, newEvidence) {
  const byId = new Map(existingEvidence.map((item) => [item.evidence_id, item]));
  for (const item of newEvidence) {
    byId.set(item.evidence_id, item);
  }
  return Array.from(byId.values()).sort((a, b) => a.evidence_id.localeCompare(b.evidence_id));
}
