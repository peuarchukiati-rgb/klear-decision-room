import {
  createInvoiceFieldEvidence,
  createSupportingDocumentEvidence,
  upsertEvidence
} from "../../evidence/src/evidenceFactory.js";

export const NORMALIZED_INVOICE_FIELDS = [
  "invoice_number",
  "vendor_name",
  "vendor_id",
  "invoice_date",
  "due_date",
  "currency",
  "subtotal",
  "tax",
  "total",
  "bank_name",
  "bank_account",
  "purchase_order"
];

function isMissing(value) {
  return value === null || value === undefined || value === "";
}

export function findInvoiceInput(decisionCase) {
  return decisionCase.input_records.find((record) => record.source_type === "INVOICE");
}

export function normalizeInvoice(decisionCase) {
  const invoiceInput = findInvoiceInput(decisionCase);
  if (!invoiceInput) {
    return {
      facts: [],
      evidence: [],
      unknowns: [
        {
          unknown_id: "UNK-INVOICE-INPUT",
          field: "invoice",
          summary: "No invoice input record is attached to the case.",
          evidence_unavailable_reason: "No input record with source_type INVOICE."
        }
      ],
      normalized_invoice: null
    };
  }

  const invoice = invoiceInput.payload || {};
  const evidence = NORMALIZED_INVOICE_FIELDS.map((field) => {
    return createInvoiceFieldEvidence(invoiceInput, field, invoice[field]);
  });
  const evidenceByField = new Map(evidence.map((item) => [item.field, item.evidence_id]));

  const facts = NORMALIZED_INVOICE_FIELDS.map((field) => ({
    fact_id: `FACT-INVOICE-${field.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`,
    field,
    value: invoice[field] ?? null,
    confidence: isMissing(invoice[field]) ? 0 : 1,
    verified: false,
    extraction_method: "structured_input",
    source_references: {
      evidence_id: evidenceByField.get(field)
    }
  }));

  const unknowns = NORMALIZED_INVOICE_FIELDS.filter((field) => isMissing(invoice[field])).map((field) => ({
    unknown_id: `UNK-INVOICE-${field.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`,
    field,
    summary: `Invoice field ${field} is unavailable.`,
    evidence_ids: [evidenceByField.get(field)]
  }));

  const supportingEvidence = decisionCase.input_records
    .filter((record) => record.source_type === "SUPPORTING_DOCUMENT")
    .map((record, index) => createSupportingDocumentEvidence(record, index));

  return {
    facts,
    evidence: upsertEvidence(evidence, supportingEvidence),
    unknowns,
    normalized_invoice: { ...invoice }
  };
}
