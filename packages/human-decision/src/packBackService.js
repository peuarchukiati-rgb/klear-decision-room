import {
  EvidenceSourceType,
  HistoryChangeType,
  OwnerRole,
  PackBackEventType,
  createOwner,
  isEnumValue
} from "../../case-schema/src/index.js";
import { createEvidence, evidenceId, upsertEvidence } from "../../evidence/src/evidenceFactory.js";
import { createHandoffArtifacts, latestDecisionEvent } from "../../handoff/src/handoffGenerator.js";

const ALLOWED_FIELDS = new Set([
  "case_id",
  "source_case_version",
  "handoff_id",
  "responding_actor",
  "event_type",
  "completed_actions",
  "new_evidence",
  "changed_fields",
  "unresolved_items",
  "note",
  "timestamp"
]);

function rejectUnknownFields(body) {
  const unknown = Object.keys(body).filter((key) => !ALLOWED_FIELDS.has(key));
  if (unknown.length) {
    throw new Error(`Unsupported pack-back field(s): ${unknown.join(", ")}`);
  }
}

function requireActor(actor) {
  if (!actor || typeof actor !== "object" || (!actor.name && !actor.email && !actor.role)) {
    throw new Error("responding_actor is required");
  }
  return {
    role: actor.role || OwnerRole.NEXT_OWNER,
    name: actor.name || "",
    email: actor.email || ""
  };
}

function normalizeNewEvidence(items = [], timestamp) {
  if (!Array.isArray(items)) {
    throw new Error("new_evidence must be an array");
  }
  return items.map((item, index) => createEvidence({
    evidence_id: item.evidence_id || evidenceId("PACK-BACK", index + 1, item.source_name || item.field),
    source_type: item.source_type || EvidenceSourceType.USER_NOTE,
    source_name: item.source_name || "pack-back",
    source_location: item.source_location || "pack-back response",
    field: item.field || "pack_back_evidence",
    value: item.value ?? item.note ?? null,
    verified: Boolean(item.verified),
    created_at: timestamp
  }));
}

export async function importPackBack(caseStore, caseId, body) {
  rejectUnknownFields(body);
  if (body.human_decision || body.human_decision_events) {
    throw new Error("Pack-back cannot mutate human decisions");
  }
  if (body.case_id !== caseId) {
    throw new Error("Pack-back case_id must match route case ID");
  }
  if (!Number.isInteger(body.source_case_version)) {
    throw new Error("source_case_version is required");
  }
  if (!isEnumValue(PackBackEventType, body.event_type)) {
    throw new Error(`event_type must be one of ${Object.values(PackBackEventType).join(", ")}`);
  }

  const decisionCase = await caseStore.getCase(caseId);
  if (body.source_case_version < decisionCase.version) {
    const error = new Error("Pack-back source version is stale");
    error.statusCode = 409;
    error.details = {
      current_version: decisionCase.version,
      source_case_version: body.source_case_version,
      changed_since_source: decisionCase.history.filter((event) => event.timestamp)
    };
    throw error;
  }
  if (body.source_case_version > decisionCase.version) {
    throw new Error("Pack-back source version cannot be newer than current case version");
  }

  if (body.handoff_id) {
    const expectedHandoff = createHandoffArtifacts(decisionCase).machine_readable.handoff_id;
    const latestEvent = latestDecisionEvent(decisionCase);
    if (latestEvent && body.handoff_id !== expectedHandoff) {
      throw new Error("handoff_id does not match latest decision handoff");
    }
  }

  const timestamp = body.timestamp || new Date().toISOString();
  const actor = requireActor(body.responding_actor);
  const newEvidence = normalizeNewEvidence(body.new_evidence, timestamp);
  const packBackEvent = {
    pack_back_id: `PB-${String((decisionCase.pack_back_events || []).length + 1).padStart(4, "0")}`,
    source_case_version: body.source_case_version,
    handoff_id: body.handoff_id || null,
    responding_actor: actor,
    event_type: body.event_type,
    completed_actions: body.completed_actions || [],
    changed_fields: body.changed_fields || [],
    unresolved_items: body.unresolved_items || [],
    note: body.note || "",
    timestamp,
    evidence_ids: newEvidence.map((item) => item.evidence_id)
  };

  const updated = await caseStore.versionCase(
    caseId,
    {
      evidence: upsertEvidence(decisionCase.evidence, newEvidence),
      pack_back_events: [...(decisionCase.pack_back_events || []), packBackEvent]
    },
    {
      actor,
      change_type: HistoryChangeType.PACK_BACK_RECORDED,
      note: `Pack-back recorded: ${body.event_type}.`,
      source_event: "pack_back"
    }
  );

  return { case: updated, pack_back: packBackEvent };
}
