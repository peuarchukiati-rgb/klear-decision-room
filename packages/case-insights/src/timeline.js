const LABELS_BY_SOURCE_EVENT = {
  api: "Case saved",
  deterministic_review: "Deterministic review completed",
  grounded_case_writer: "Grounded case brief prepared"
};

const LABELS_BY_CHANGE_TYPE = {
  CASE_CREATED: "Case created",
  CASE_SAVED: "Case saved",
  CASE_VERSIONED: "Case versioned",
  EVIDENCE_ADDED: "Evidence added",
  STATUS_CHANGED: "Status changed",
  OWNER_CHANGED: "Owner changed",
  HUMAN_DECISION_RECORDED: "Human decision recorded"
};

export function labelForHistoryEvent(event) {
  if (event.change_type === "CASE_CREATED") {
    return "Case created";
  }
  return LABELS_BY_SOURCE_EVENT[event.source_event] ||
    LABELS_BY_CHANGE_TYPE[event.change_type] ||
    "Case event recorded";
}

export function deriveDecisionTimeline(decisionCase) {
  return {
    case_id: decisionCase.case_id,
    version: decisionCase.version,
    events: decisionCase.history.map((event, index) => ({
      sequence: index + 1,
      timestamp: event.timestamp,
      label: labelForHistoryEvent(event),
      actor: event.actor,
      event_type: event.change_type,
      source_event: event.source_event,
      previous_status: event.previous_status,
      new_status: event.new_status,
      changed_fields: event.changed_fields,
      note: event.note
    }))
  };
}
