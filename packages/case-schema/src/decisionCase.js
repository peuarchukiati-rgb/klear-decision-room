import {
  CaseStatus,
  CaseType,
  HistoryChangeType,
  OwnerRole,
  isEnumValue
} from "./enums.js";

export function createOwner(role, name = "") {
  return {
    role,
    name,
    email: ""
  };
}

export function createEmptyAiCaseBrief() {
  return {
    summary: "",
    risk_explanation: "",
    recommended_disposition: "",
    missing_information_request: "",
    handoff_note: "",
    citations: [],
    validation_receipt: null
  };
}

export function createEmptyHumanDecision() {
  return {
    decision_event_id: null,
    decision: null,
    decided_by: null,
    decided_at: null,
    reason: null,
    required_evidence: [],
    escalation_target: null
  };
}

export function createHistoryEvent({
  actor = createOwner(OwnerRole.SYSTEM, "System"),
  change_type = HistoryChangeType.CASE_VERSIONED,
  changed_fields = [],
  previous_status = null,
  new_status = null,
  note = "",
  source_event = "api",
  timestamp = new Date().toISOString()
} = {}) {
  return {
    timestamp,
    actor,
    change_type,
    changed_fields,
    previous_status,
    new_status,
    note,
    source_event
  };
}

export function createDecisionCase({
  case_id,
  case_type = CaseType.FINANCE_PAYMENT_REVIEW,
  status = CaseStatus.DRAFT,
  created_at = new Date().toISOString(),
  updated_at = created_at,
  requester = createOwner(OwnerRole.REQUESTER, ""),
  current_owner = createOwner(OwnerRole.REVIEWER, "Finance Reviewer"),
  next_owner = createOwner(OwnerRole.REQUESTER, ""),
  input_records = [],
  facts = [],
  rule_results = [],
  unknowns = [],
  evidence = [],
  ai_case_brief = createEmptyAiCaseBrief(),
  human_decision = createEmptyHumanDecision(),
  human_decision_events = [],
  pack_back_events = [],
  history = []
} = {}) {
  if (!case_id) {
    throw new Error("case_id is required");
  }

  const initialHistory = history.length
    ? history
    : [
        createHistoryEvent({
          change_type: HistoryChangeType.CASE_CREATED,
          previous_status: null,
          new_status: status,
          note: "Case created.",
          timestamp: created_at
        })
      ];

  const decisionCase = {
    case_id,
    case_type,
    version: 1,
    status,
    created_at,
    updated_at,
    requester,
    current_owner,
    next_owner,
    input_records,
    facts,
    rule_results,
    unknowns,
    evidence,
    ai_case_brief,
    human_decision,
    human_decision_events,
    pack_back_events,
    history: initialHistory
  };

  validateDecisionCase(decisionCase);
  return decisionCase;
}

export function validateDecisionCase(decisionCase) {
  const errors = [];

  if (!decisionCase || typeof decisionCase !== "object") {
    throw new Error("DecisionCase must be an object");
  }

  if (!decisionCase.case_id || typeof decisionCase.case_id !== "string") {
    errors.push("case_id must be a non-empty string");
  }

  if (!isEnumValue(CaseType, decisionCase.case_type)) {
    errors.push(`case_type must be one of ${Object.values(CaseType).join(", ")}`);
  }

  if (!Number.isInteger(decisionCase.version) || decisionCase.version < 1) {
    errors.push("version must be a positive integer");
  }

  if (!isEnumValue(CaseStatus, decisionCase.status)) {
    errors.push(`status must be one of ${Object.values(CaseStatus).join(", ")}`);
  }

  for (const field of [
    "input_records",
    "facts",
    "rule_results",
    "unknowns",
    "evidence",
    "human_decision_events",
    "pack_back_events",
    "history"
  ]) {
    if (!Array.isArray(decisionCase[field])) {
      errors.push(`${field} must be an array`);
    }
  }

  for (const field of ["requester", "current_owner", "next_owner"]) {
    if (!decisionCase[field] || typeof decisionCase[field] !== "object") {
      errors.push(`${field} must be an owner object`);
    }
  }

  if (!decisionCase.ai_case_brief || typeof decisionCase.ai_case_brief !== "object") {
    errors.push("ai_case_brief must be an object");
  }

  if (!decisionCase.human_decision || typeof decisionCase.human_decision !== "object") {
    errors.push("human_decision must be an object");
  }

  if (errors.length) {
    throw new Error(`Invalid DecisionCase: ${errors.join("; ")}`);
  }

  return true;
}

export function changedFields(previousCase, nextCase) {
  const fields = [
    "status",
    "requester",
    "current_owner",
    "next_owner",
    "input_records",
    "facts",
    "rule_results",
    "unknowns",
    "evidence",
    "ai_case_brief",
    "human_decision",
    "human_decision_events",
    "pack_back_events"
  ];

  return fields.filter((field) => {
    return JSON.stringify(previousCase[field]) !== JSON.stringify(nextCase[field]);
  });
}
