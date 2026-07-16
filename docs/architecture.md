# Architecture

KLEAR Decision Room separates the system into three lanes:

- Truth lane: deterministic services validate facts and produce rule results.
- Case-writing lane: AI prepares grounded briefs from supplied facts, evidence, unknowns, and rule results. This is deferred past Phase 2.
- Decision lane: humans approve, reject, request evidence, or escalate. The schema models this state, but Phase 2 does not build the reviewer UI.

## Modules

- `packages/case-schema`: controlled enums, `DecisionCase` factory, and validation.
- `packages/case-store`: JSON-file persistence and versioning.
- `packages/intake`: invoice normalization into facts, unknowns, and field evidence.
- `packages/evidence`: stable evidence object creation.
- `packages/rules-engine`: deterministic finance approval review.
- `packages/handoff`: minimal human and machine handoff artifact generation.
- `apps/api`: HTTP API over the case store.
- `data/demo`: neutral synthetic finance data.

## Prior Work Boundary

Finance Reviewer influences the future truth layer only. KLEAR influences continuity, versioning, and handoff behavior only. This project is not a reskin of either.
