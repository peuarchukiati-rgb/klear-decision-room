import {
  CaseStatus,
  HistoryChangeType,
  HumanDecision,
  OwnerRole,
  createOwner,
  isEnumValue
} from "../../case-schema/src/index.js";
import { deriveCaseReadiness, loadReadinessPolicy } from "../../case-insights/src/index.js";

function requireOwner(owner, label) {
  if (!owner || typeof owner !== "object") {
    throw new Error(`${label} is required`);
  }
  if (!owner.name && !owner.email && !owner.role) {
    throw new Error(`${label} must include identity`);
  }
  return {
    role: owner.role || OwnerRole.REVIEWER,
    name: owner.name || "",
    email: owner.email || ""
  };
}

function requireText(value, label) {
  if (!value || typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required`);
  }
  return value.trim();
}

function nextDecisionEventId(existingEvents) {
  return `HDEC-${String(existingEvents.length + 1).padStart(4, "0")}`;
}

function hasHardGateBlocker(decisionCase, policy) {
  const hardGateRules = new Set(
    (policy.rules || []).filter((rule) => rule.hard_gate).map((rule) => rule.rule_id)
  );
  return decisionCase.rule_results.some((rule) => {
    return hardGateRules.has(rule.rule_id) &&
      (rule.status === "FAIL" || rule.status === "UNKNOWN" || rule.recommended_gate === "HOLD");
  });
}

function statusForAction(action) {
  return {
    [HumanDecision.APPROVE]: CaseStatus.APPROVED,
    [HumanDecision.REJECT]: CaseStatus.REJECTED,
    [HumanDecision.REQUEST_EVIDENCE]: CaseStatus.EVIDENCE_REQUIRED,
    [HumanDecision.ESCALATE]: CaseStatus.ESCALATED
  }[action];
}

function validateAction(decisionCase, body, policy) {
  const action = body.action;
  if (!isEnumValue(HumanDecision, action)) {
    throw new Error(`action must be one of ${Object.values(HumanDecision).join(", ")}`);
  }

  const reviewer = requireOwner(body.reviewer, "reviewer");
  const reason = requireText(body.reason, "decision reason");
  const readiness = deriveCaseReadiness(decisionCase, policy);

  if (action === HumanDecision.APPROVE) {
    if (!readiness.ready_for_decision || hasHardGateBlocker(decisionCase, policy)) {
      throw new Error("APPROVE requires the case to be ready for decision with no hard-gate blockers");
    }
  }

  if (action === HumanDecision.REQUEST_EVIDENCE) {
    const requiredEvidence = body.required_evidence || [];
    if (!Array.isArray(requiredEvidence) || requiredEvidence.length === 0) {
      throw new Error("REQUEST_EVIDENCE requires required_evidence");
    }
  }

  if (action === HumanDecision.ESCALATE) {
    requireOwner(body.escalation_target || body.next_owner, "escalation target");
  }

  return { action, reviewer, reason, readiness };
}

export async function submitHumanDecision(
  caseStore,
  caseId,
  body,
  { policy = null } = {}
) {
  const decisionCase = await caseStore.getCase(caseId);
  const activePolicy = policy || (await loadReadinessPolicy());
  const { action, reviewer, reason, readiness } = validateAction(decisionCase, body, activePolicy);
  const timestamp = body.timestamp || new Date().toISOString();
  const existingEvents = decisionCase.human_decision_events || [];
  const decisionEvent = {
    decision_event_id: nextDecisionEventId(existingEvents),
    action,
    reviewer,
    reason,
    decided_at: timestamp,
    case_version: decisionCase.version,
    readiness,
    required_evidence: body.required_evidence || [],
    escalation_target: body.escalation_target || null,
    next_owner: body.next_owner || null
  };
  const humanDecisionSnapshot = {
    decision_event_id: decisionEvent.decision_event_id,
    decision: action,
    decided_by: reviewer,
    decided_at: timestamp,
    reason,
    required_evidence: decisionEvent.required_evidence,
    escalation_target: decisionEvent.escalation_target
  };
  const nextOwner = body.next_owner ||
    body.escalation_target ||
    (action === HumanDecision.REQUEST_EVIDENCE
      ? decisionCase.requester
      : decisionCase.next_owner);

  const updated = await caseStore.versionCase(
    caseId,
    {
      status: statusForAction(action),
      current_owner: reviewer,
      next_owner: nextOwner,
      human_decision_events: [...existingEvents, decisionEvent],
      human_decision: humanDecisionSnapshot
    },
    {
      actor: reviewer,
      change_type: HistoryChangeType.HUMAN_DECISION_RECORDED,
      note: `Human decision recorded: ${action}.`,
      source_event: "human_decision"
    }
  );

  return { case: updated, decision_event: decisionEvent };
}
