export const CaseStatus = Object.freeze({
  DRAFT: "DRAFT",
  INGESTING: "INGESTING",
  UNDER_REVIEW: "UNDER_REVIEW",
  EVIDENCE_REQUIRED: "EVIDENCE_REQUIRED",
  READY_FOR_DECISION: "READY_FOR_DECISION",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  ESCALATED: "ESCALATED",
  CLOSED: "CLOSED"
});

export const RuleResultStatus = Object.freeze({
  PASS: "PASS",
  FAIL: "FAIL",
  WARNING: "WARNING",
  UNKNOWN: "UNKNOWN",
  NOT_APPLICABLE: "NOT_APPLICABLE"
});

export const HumanDecision = Object.freeze({
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  REQUEST_EVIDENCE: "REQUEST_EVIDENCE",
  ESCALATE: "ESCALATE"
});

export const CaseType = Object.freeze({
  FINANCE_PAYMENT_REVIEW: "FINANCE_PAYMENT_REVIEW"
});

export const OwnerRole = Object.freeze({
  REQUESTER: "REQUESTER",
  REVIEWER: "REVIEWER",
  NEXT_OWNER: "NEXT_OWNER",
  SYSTEM: "SYSTEM"
});

export const EvidenceSourceType = Object.freeze({
  INVOICE: "INVOICE",
  VENDOR_MASTER: "VENDOR_MASTER",
  PAID_LEDGER: "PAID_LEDGER",
  SUPPORTING_DOCUMENT: "SUPPORTING_DOCUMENT",
  POLICY: "POLICY",
  USER_NOTE: "USER_NOTE"
});

export const HistoryChangeType = Object.freeze({
  CASE_CREATED: "CASE_CREATED",
  CASE_SAVED: "CASE_SAVED",
  CASE_VERSIONED: "CASE_VERSIONED",
  EVIDENCE_ADDED: "EVIDENCE_ADDED",
  STATUS_CHANGED: "STATUS_CHANGED",
  OWNER_CHANGED: "OWNER_CHANGED",
  HUMAN_DECISION_RECORDED: "HUMAN_DECISION_RECORDED"
});

export function enumValues(enumObject) {
  return Object.values(enumObject);
}

export function isEnumValue(enumObject, value) {
  return enumValues(enumObject).includes(value);
}
