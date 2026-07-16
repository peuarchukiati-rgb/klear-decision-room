# KLEAR Decision Room

**Where AI prepares decisions without owning them.**

KLEAR Decision Room turns messy operational evidence into a persistent, auditable, decision lifecycle.

AI prepares the case. Systems verify the facts. Humans own the decision.

## The Problem

Most enterprise AI workflows stop at an answer. Real operational decisions need more than an answer: they need facts, evidence, rule outcomes, unknowns, recommendations, human accountability, and a record of what changed over time.

The flagship demo is a finance approval workflow because payment review is easy to judge: duplicate invoices, bank-account mismatches, missing vendors, and missing support all require evidence-backed decisions.

## The Decision

KLEAR Decision Room keeps each lane independently verifiable and independently replaceable:

```text
Truth Lane
    ↓
Grounded Case Writer
    ↓
Human Decision
    ↓
Decision Handoff
    ↓
Pack Back
    ↓
Versioned DecisionCase
```

- **Truth Lane:** deterministic normalization, evidence creation, and rules decide what can be verified.
- **Grounded Case Writer:** the configured model, or a deterministic fallback, writes a grounded case brief from supplied facts, rules, unknowns, and evidence only.
- **Human Decision:** a reviewer approves, rejects, requests evidence, or escalates through an explicit decision event.
- **Decision Handoff:** the latest persisted case becomes a two-plane human-readable and machine-readable handoff.
- **Pack Back:** the next owner returns structured updates that merge into the case through a guarded version bump.

## Architecture

The durable object is a `DecisionCase`:

- input records
- normalized facts
- evidence
- unknowns
- deterministic rule results
- grounded case brief
- human decision events
- latest human decision snapshot
- pack-back events
- history

`human_decision_events` is the canonical source of truth. `human_decision` is a derived convenience snapshot of the latest relevant human decision event.

Version snapshots are immutable. No historical snapshot may be modified; all new information creates a new version.

Derived projections never become independent sources of truth. Readiness, traceability, timeline, Decision Story, and handoff are reproducible from persisted `DecisionCase` state.

Phase 4 exposes derived judge-facing intelligence without changing that source-of-truth boundary:

- **Case Readiness:** evidence completeness, policy coverage, unknown count, blocking rules, and ready-for-decision state.
- **Traceability Map:** rule-to-evidence and evidence-to-rule links.
- **Decision Timeline:** readable projection of stored history events.
- **Decision Story:** one aggregate view of readiness, traceability, timeline, latest decision, and latest handoff.
- **Decision Handoff:** deterministic two-plane state transfer from the latest case version.

## Walkthrough

1. Create or seed a demo case.
2. Run deterministic review.
3. Generate a grounded case brief.
4. Inspect readiness, traceability, and timeline.
5. Submit an explicit human decision.
6. Inspect the immutable version snapshot and Decision Handoff.
7. Import a Pack Back update from the next owner.
8. Inspect the complete Decision Story.

Example:

```bash
npm start
```

Open the reviewer console:

```text
http://127.0.0.1:8787/
```

Or use the API from another shell:

```bash
node scripts/seed-demo-case.js SCN-BANK-MISMATCH
curl -X POST http://127.0.0.1:8787/cases/CASE-2026-0001/deterministic-review
curl -X POST http://127.0.0.1:8787/cases/CASE-2026-0001/case-brief
curl http://127.0.0.1:8787/cases/CASE-2026-0001/readiness
curl http://127.0.0.1:8787/cases/CASE-2026-0001/traceability
curl http://127.0.0.1:8787/cases/CASE-2026-0001/timeline
curl http://127.0.0.1:8787/cases/CASE-2026-0001/decision-story
```

## API

- `GET /health`
- `POST /cases`
- `GET /cases`
- `GET /cases/:caseId`
- `PUT /cases/:caseId`
- `POST /cases/:caseId/versions`
- `POST /cases/:caseId/deterministic-review`
- `POST /cases/:caseId/case-brief`
- `POST /cases/:caseId/decisions`
- `GET /cases/:caseId/handoff`
- `GET /cases/:caseId/versions`
- `POST /cases/:caseId/pack-back`
- `GET /cases/:caseId/decision-story`
- `GET /cases/:caseId/readiness`
- `GET /cases/:caseId/traceability`
- `GET /cases/:caseId/timeline`

## Run

```bash
npm start
```

The API listens on `PORT` or `8787`.

The same server serves the static reviewer console at `/`.

## Tests

```bash
npm test
```

The tests cover deterministic rules, evidence citation integrity, model-output validation, human-decision immutability, explicit decision transitions, immutable versions, handoff lineage, pack-back guards, readiness, traceability, timeline, Decision Story, reviewer UI smoke coverage, and README product positioning.

## Model Configuration

Deterministic review never calls a model.

The case writer calls a model only when both `OPENAI_API_KEY` and `KLEAR_MODEL_ID` are configured. Without credentials, it produces a deterministic fallback brief so judges can run the project from a fresh clone.

Model identifiers must come from environment or config and must not be hardcoded in source.

## Future Domains

The current demo stays focused on finance approval. The same `DecisionCase` architecture can later support compliance, underwriting, onboarding, maintenance, QA, or submission auditing workflows where evidence, rules, AI explanation, and human accountability must remain separate.
