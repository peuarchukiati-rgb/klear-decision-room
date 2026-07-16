import { createHandoffArtifacts } from "../../handoff/src/handoffGenerator.js";
import { deriveCaseReadiness } from "./readiness.js";
import { deriveDecisionTimeline } from "./timeline.js";
import { deriveTraceabilityMap } from "./traceability.js";

function latestDecisionEvent(decisionCase) {
  return (decisionCase.human_decision_events || []).at(-1) || null;
}

export function deriveDecisionStory(decisionCase, policy) {
  return {
    case_id: decisionCase.case_id,
    version: decisionCase.version,
    status: decisionCase.status,
    current_owner: decisionCase.current_owner,
    next_owner: decisionCase.next_owner,
    readiness: deriveCaseReadiness(decisionCase, policy),
    timeline: deriveDecisionTimeline(decisionCase),
    traceability: deriveTraceabilityMap(decisionCase),
    latest_decision: {
      snapshot: decisionCase.human_decision,
      event: latestDecisionEvent(decisionCase)
    },
    latest_handoff: createHandoffArtifacts(decisionCase),
    unresolved_items: decisionCase.unknowns,
    pack_back_events: decisionCase.pack_back_events || []
  };
}
