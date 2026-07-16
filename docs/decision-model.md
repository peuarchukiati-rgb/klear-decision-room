# Decision Model

The durable object is a `DecisionCase`.

Every meaningful change creates a new case version through the store's version operation. Prior versions remain in history and the latest case carries:

- case identity and type
- controlled status
- requester/current/next owner
- input records
- normalized facts
- deterministic rule results
- unknowns
- evidence
- AI case brief placeholder
- human decision
- history events

Phase 1 does not decide whether a case should pass or fail. It only preserves state so later deterministic and AI layers have a stable substrate.
