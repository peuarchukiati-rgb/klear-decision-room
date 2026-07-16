import assert from "node:assert/strict";

export function assertHumanDecisionUnchanged(beforeCase, afterCase) {
  assert.deepEqual(
    afterCase.human_decision,
    beforeCase.human_decision,
    "system lanes must not mutate human_decision"
  );
  assert.deepEqual(
    afterCase.human_decision_events || [],
    beforeCase.human_decision_events || [],
    "system lanes must not mutate human_decision_events"
  );
}
