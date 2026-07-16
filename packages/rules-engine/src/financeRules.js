import { RuleResultStatus } from "../../case-schema/src/index.js";
import {
  createPaidLedgerEvidence,
  createVendorEvidence,
  evidenceId,
  upsertEvidence
} from "../../evidence/src/evidenceFactory.js";
import { ruleResult } from "./ruleResult.js";

function isMissing(value) {
  return value === null || value === undefined || value === "";
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function invoiceEvidence(field) {
  return evidenceId("INVOICE", field);
}

function findVendor(vendorMaster, invoice) {
  if (!invoice?.vendor_id) {
    return null;
  }
  return vendorMaster.find((vendor) => vendor.vendor_id === invoice.vendor_id) || null;
}

function findLedgerMatches(paidLedger, invoice) {
  return paidLedger.filter((payment) => {
    return (
      payment.vendor_id === invoice.vendor_id &&
      payment.invoice_number === invoice.invoice_number
    );
  });
}

export function runFinanceRules({ normalized_invoice, vendor_master, paid_ledger, policy, evidence }) {
  const vendor = findVendor(vendor_master, normalized_invoice);
  const ledgerMatches = normalized_invoice ? findLedgerMatches(paid_ledger, normalized_invoice) : [];
  let enrichedEvidence = evidence;

  if (vendor) {
    enrichedEvidence = upsertEvidence(enrichedEvidence, [
      createVendorEvidence(vendor, "vendor_id"),
      createVendorEvidence(vendor, "bank_account"),
      createVendorEvidence(vendor, "status")
    ]);
  }

  if (ledgerMatches.length) {
    enrichedEvidence = upsertEvidence(
      enrichedEvidence,
      ledgerMatches.map((payment) => createPaidLedgerEvidence(payment))
    );
  }

  const ruleResults = [
    duplicateInvoiceRule(normalized_invoice, ledgerMatches),
    vendorExistenceRule(normalized_invoice, vendor),
    bankAccountMatchRule(normalized_invoice, vendor),
    amountConsistencyRule(normalized_invoice, policy),
    requiredFieldsRule(normalized_invoice, policy),
    previousPaymentStatusRule(normalized_invoice, ledgerMatches),
    supportingEvidenceRule(normalized_invoice, policy, enrichedEvidence)
  ];

  return {
    rule_results: ruleResults,
    evidence: enrichedEvidence
  };
}

export function duplicateInvoiceRule(invoice, ledgerMatches) {
  if (!invoice) {
    return ruleResult({
      rule_id: "R-001",
      rule_name: "Duplicate invoice",
      status: RuleResultStatus.UNKNOWN,
      severity: "HIGH",
      summary: "Duplicate invoice check could not run because no invoice was normalized.",
      details: { evidence_unavailable_reason: "No normalized invoice." },
      recommended_gate: "HOLD"
    });
  }

  const required = ["vendor_id", "invoice_number", "total", "invoice_date"];
  const missing = required.filter((field) => isMissing(invoice[field]));
  if (missing.length) {
    return ruleResult({
      rule_id: "R-001",
      rule_name: "Duplicate invoice",
      status: RuleResultStatus.UNKNOWN,
      severity: "HIGH",
      summary: "Duplicate invoice check is unknown because required matching fields are missing.",
      evidence_ids: missing.map(invoiceEvidence),
      details: { missing_fields: missing },
      recommended_gate: "HOLD"
    });
  }

  const exactMatch = ledgerMatches.find((payment) => {
    return payment.total === invoice.total && payment.invoice_date === invoice.invoice_date;
  });

  if (exactMatch) {
    return ruleResult({
      rule_id: "R-001",
      rule_name: "Duplicate invoice",
      status: RuleResultStatus.FAIL,
      severity: "HIGH",
      summary: "Invoice matches a previously paid ledger entry.",
      evidence_ids: [
        invoiceEvidence("vendor_id"),
        invoiceEvidence("invoice_number"),
        invoiceEvidence("total"),
        invoiceEvidence("invoice_date"),
        evidenceId("PAID-LEDGER", exactMatch.payment_id)
      ],
      details: {
        matched_payment_id: exactMatch.payment_id,
        match_fields: ["vendor_id", "invoice_number", "total", "invoice_date"]
      },
      recommended_gate: "HOLD"
    });
  }

  return ruleResult({
    rule_id: "R-001",
    rule_name: "Duplicate invoice",
    status: RuleResultStatus.PASS,
    severity: "LOW",
    summary: "No duplicate invoice match found in paid ledger.",
    evidence_ids: [invoiceEvidence("vendor_id"), invoiceEvidence("invoice_number"), invoiceEvidence("total")],
    details: { match_fields: ["vendor_id", "invoice_number", "total", "invoice_date"] },
    recommended_gate: "CONTINUE"
  });
}

export function vendorExistenceRule(invoice, vendor) {
  if (!invoice || isMissing(invoice.vendor_id)) {
    return ruleResult({
      rule_id: "R-002",
      rule_name: "Vendor existence",
      status: RuleResultStatus.UNKNOWN,
      severity: "HIGH",
      summary: "Vendor existence is unknown because the invoice vendor ID is missing.",
      evidence_ids: [invoiceEvidence("vendor_id")],
      details: { missing_fields: ["vendor_id"] },
      recommended_gate: "HOLD"
    });
  }

  if (!vendor) {
    return ruleResult({
      rule_id: "R-002",
      rule_name: "Vendor existence",
      status: RuleResultStatus.UNKNOWN,
      severity: "HIGH",
      summary: "Submitted vendor is not present in approved vendor master.",
      evidence_ids: [invoiceEvidence("vendor_id"), invoiceEvidence("vendor_name")],
      details: { vendor_id: invoice.vendor_id },
      recommended_gate: "HOLD"
    });
  }

  return ruleResult({
    rule_id: "R-002",
    rule_name: "Vendor existence",
    status: RuleResultStatus.PASS,
    severity: "LOW",
    summary: "Vendor exists in approved vendor master.",
    evidence_ids: [invoiceEvidence("vendor_id"), evidenceId("VENDOR-MASTER", vendor.vendor_id, "status")],
    details: { vendor_id: vendor.vendor_id, vendor_status: vendor.status },
    recommended_gate: "CONTINUE"
  });
}

export function bankAccountMatchRule(invoice, vendor) {
  if (!invoice || isMissing(invoice.bank_account)) {
    return ruleResult({
      rule_id: "R-003",
      rule_name: "Vendor bank-account match",
      status: RuleResultStatus.UNKNOWN,
      severity: "HIGH",
      summary: "Bank-account verification is unknown because invoice bank account is missing.",
      evidence_ids: [invoiceEvidence("bank_account")],
      details: { missing_fields: ["bank_account"] },
      recommended_gate: "HOLD"
    });
  }

  if (!vendor) {
    return ruleResult({
      rule_id: "R-003",
      rule_name: "Vendor bank-account match",
      status: RuleResultStatus.UNKNOWN,
      severity: "HIGH",
      summary: "Bank-account verification is unknown because no approved vendor record is available.",
      evidence_ids: [invoiceEvidence("vendor_id"), invoiceEvidence("bank_account")],
      details: { evidence_unavailable_reason: "Vendor master record unavailable." },
      recommended_gate: "HOLD"
    });
  }

  if (invoice.bank_account !== vendor.bank_account) {
    return ruleResult({
      rule_id: "R-003",
      rule_name: "Vendor bank-account match",
      status: RuleResultStatus.FAIL,
      severity: "HIGH",
      summary: "Verification required: submitted bank account differs from approved vendor master.",
      evidence_ids: [invoiceEvidence("bank_account"), evidenceId("VENDOR-MASTER", vendor.vendor_id, "bank_account")],
      details: {
        submitted_bank_account: invoice.bank_account,
        approved_bank_account: vendor.bank_account
      },
      recommended_gate: "HOLD"
    });
  }

  return ruleResult({
    rule_id: "R-003",
    rule_name: "Vendor bank-account match",
    status: RuleResultStatus.PASS,
    severity: "LOW",
    summary: "Submitted bank account matches approved vendor master.",
    evidence_ids: [invoiceEvidence("bank_account"), evidenceId("VENDOR-MASTER", vendor.vendor_id, "bank_account")],
    details: {},
    recommended_gate: "CONTINUE"
  });
}

export function amountConsistencyRule(invoice, policy) {
  const subtotal = numberOrNull(invoice?.subtotal);
  const tax = numberOrNull(invoice?.tax);
  const total = numberOrNull(invoice?.total);
  const evidence_ids = ["subtotal", "tax", "total"].map(invoiceEvidence);

  if (subtotal === null || tax === null || total === null) {
    return ruleResult({
      rule_id: "R-004",
      rule_name: "Amount consistency",
      status: RuleResultStatus.UNKNOWN,
      severity: "MEDIUM",
      summary: "Amount consistency is unknown because subtotal, tax, or total is missing.",
      evidence_ids,
      details: {
        missing_fields: [
          subtotal === null ? "subtotal" : null,
          tax === null ? "tax" : null,
          total === null ? "total" : null
        ].filter(Boolean)
      },
      recommended_gate: "HOLD"
    });
  }

  const expected = Number((subtotal + tax).toFixed(2));
  const difference = Math.abs(expected - total);
  const tolerance = policy.amount_tolerance ?? 0.01;

  if (difference > tolerance) {
    return ruleResult({
      rule_id: "R-004",
      rule_name: "Amount consistency",
      status: RuleResultStatus.FAIL,
      severity: "MEDIUM",
      summary: "Invoice subtotal plus tax does not equal total within configured tolerance.",
      evidence_ids,
      details: { subtotal, tax, expected_total: expected, submitted_total: total, tolerance, difference },
      recommended_gate: "HOLD"
    });
  }

  return ruleResult({
    rule_id: "R-004",
    rule_name: "Amount consistency",
    status: RuleResultStatus.PASS,
    severity: "LOW",
    summary: "Invoice subtotal plus tax equals total within configured tolerance.",
    evidence_ids,
    details: { subtotal, tax, expected_total: expected, submitted_total: total, tolerance, difference },
    recommended_gate: "CONTINUE"
  });
}

export function requiredFieldsRule(invoice, policy) {
  const requiredFields = policy.required_invoice_fields || [];
  const missing = requiredFields.filter((field) => isMissing(invoice?.[field]));

  if (missing.length) {
    return ruleResult({
      rule_id: "R-005",
      rule_name: "Required fields",
      status: RuleResultStatus.UNKNOWN,
      severity: "MEDIUM",
      summary: "One or more required invoice fields are unavailable.",
      evidence_ids: missing.map(invoiceEvidence),
      details: { missing_fields: missing },
      recommended_gate: "HOLD"
    });
  }

  return ruleResult({
    rule_id: "R-005",
    rule_name: "Required fields",
    status: RuleResultStatus.PASS,
    severity: "LOW",
    summary: "All configured required invoice fields are present.",
    evidence_ids: requiredFields.map(invoiceEvidence),
    details: { required_fields: requiredFields },
    recommended_gate: "CONTINUE"
  });
}

export function previousPaymentStatusRule(invoice, ledgerMatches) {
  if (!invoice || isMissing(invoice.vendor_id) || isMissing(invoice.invoice_number)) {
    return ruleResult({
      rule_id: "R-006",
      rule_name: "Previous payment status",
      status: RuleResultStatus.UNKNOWN,
      severity: "HIGH",
      summary: "Previous payment status is unknown because vendor ID or invoice number is missing.",
      evidence_ids: [invoiceEvidence("vendor_id"), invoiceEvidence("invoice_number")],
      details: { missing_fields: ["vendor_id", "invoice_number"].filter((field) => isMissing(invoice?.[field])) },
      recommended_gate: "HOLD"
    });
  }

  const paidMatch = ledgerMatches.find((payment) => payment.status === "PAID");
  if (paidMatch) {
    return ruleResult({
      rule_id: "R-006",
      rule_name: "Previous payment status",
      status: RuleResultStatus.FAIL,
      severity: "HIGH",
      summary: "A matching invoice has already been processed as paid.",
      evidence_ids: [
        invoiceEvidence("vendor_id"),
        invoiceEvidence("invoice_number"),
        evidenceId("PAID-LEDGER", paidMatch.payment_id)
      ],
      details: { matched_payment_id: paidMatch.payment_id, payment_status: paidMatch.status },
      recommended_gate: "HOLD"
    });
  }

  return ruleResult({
    rule_id: "R-006",
    rule_name: "Previous payment status",
    status: RuleResultStatus.PASS,
    severity: "LOW",
    summary: "No matching paid invoice found in paid ledger.",
    evidence_ids: [invoiceEvidence("vendor_id"), invoiceEvidence("invoice_number")],
    details: {},
    recommended_gate: "CONTINUE"
  });
}

export function supportingEvidenceRule(invoice, policy, evidence) {
  const threshold = policy.supporting_evidence?.required_over_total;
  const accepted = policy.supporting_evidence?.accepted_source_types || [];

  if (numberOrNull(invoice?.total) === null) {
    return ruleResult({
      rule_id: "R-007",
      rule_name: "Supporting evidence requirement",
      status: RuleResultStatus.UNKNOWN,
      severity: "MEDIUM",
      summary: "Supporting evidence requirement is unknown because invoice total is unavailable.",
      evidence_ids: [invoiceEvidence("total")],
      details: { missing_fields: ["total"] },
      recommended_gate: "HOLD"
    });
  }

  if (threshold === null || threshold === undefined || invoice.total <= threshold) {
    return ruleResult({
      rule_id: "R-007",
      rule_name: "Supporting evidence requirement",
      status: RuleResultStatus.NOT_APPLICABLE,
      severity: "LOW",
      summary: "Supporting evidence is not required for this invoice total.",
      evidence_ids: [invoiceEvidence("total")],
      details: { threshold, total: invoice.total },
      recommended_gate: "CONTINUE"
    });
  }

  const supportingEvidence = evidence.filter((item) => accepted.includes(item.source_type));
  if (!supportingEvidence.length) {
    return ruleResult({
      rule_id: "R-007",
      rule_name: "Supporting evidence requirement",
      status: RuleResultStatus.FAIL,
      severity: "MEDIUM",
      summary: "Supporting evidence is required for this invoice total but no accepted supporting document is attached.",
      evidence_ids: [invoiceEvidence("total")],
      details: {
        threshold,
        total: invoice.total,
        accepted_source_types: accepted,
        evidence_unavailable_reason: "No accepted supporting document attached."
      },
      recommended_gate: "HOLD"
    });
  }

  return ruleResult({
    rule_id: "R-007",
    rule_name: "Supporting evidence requirement",
    status: RuleResultStatus.PASS,
    severity: "LOW",
    summary: "Required supporting evidence is attached.",
    evidence_ids: [invoiceEvidence("total"), ...supportingEvidence.map((item) => item.evidence_id)],
    details: { threshold, total: invoice.total, accepted_source_types: accepted },
    recommended_gate: "CONTINUE"
  });
}
