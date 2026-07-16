# Architecture

KLEAR Decision Room separates the system into three lanes:

- Truth lane: deterministic services validate facts and produce rule results. Phase 2 will implement this.
- Case-writing lane: AI prepares grounded briefs from supplied facts, evidence, unknowns, and rule results. This is deferred past Phase 1.
- Decision lane: humans approve, reject, request evidence, or escalate. Phase 1 models this state but does not build the reviewer UI.

## Phase 1 Modules

- `packages/case-schema`: controlled enums, `DecisionCase` factory, and validation.
- `packages/case-store`: JSON-file persistence and versioning.
- `packages/handoff`: minimal human and machine handoff artifact generation.
- `apps/api`: HTTP API over the case store.
- `data/demo`: neutral synthetic finance data.

## Prior Work Boundary

Finance Reviewer influences the future truth layer only. KLEAR influences continuity, versioning, and handoff behavior only. This project is not a reskin of either.
