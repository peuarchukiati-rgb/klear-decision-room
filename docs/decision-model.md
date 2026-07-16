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

Phase 2 deterministic review writes normalized facts, evidence, unknowns, and rule results onto the case. It may update case status based on deterministic review state, but it must not mutate `human_decision`.

Deterministic review may transition cases only into workflow-readiness states. `APPROVED`, `REJECTED`, and `CLOSED` require an explicit human decision event.

Phase 3 writes only `ai_case_brief`. The case writer may summarize, explain, recommend, request missing information, and draft handoff notes. It must not alter deterministic rule results or human decisions.

Phase 3.5 adds derived projections over the case:

- case readiness, which is deterministic case completeness rather than model confidence
- traceability map, which links rule results to evidence and evidence back to rules
- decision timeline, which renders `history` as judge-readable events

These projections are calculated from current case state and are not persisted as new core fields.
