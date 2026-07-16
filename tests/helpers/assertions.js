import assert from "node:assert/strict";

export function assertHumanDecisionUnchanged(beforeCase, afterCase) {
  assert.deepEqual(
    afterCase.human_decision,
    beforeCase.human_decision,
    "system lanes must not mutate human_decision"
  );
}
