# KLEAR Decision Room

**Where AI prepares decisions without owning them.**

KLEAR Decision Room turns messy operational evidence into a persistent, auditable, decision-ready case.

AI prepares the case. Systems verify the facts. Humans own the decision.

## The Problem

Most enterprise AI workflows stop at an answer. Real operational decisions need more than an answer: they need facts, evidence, rule outcomes, unknowns, recommendations, human accountability, and a record of what changed over time.

The flagship demo is a finance approval workflow because payment review is easy to judge: duplicate invoices, bank-account mismatches, missing vendors, and missing support all require evidence-backed decisions.

## The Decision

KLEAR Decision Room separates responsibility into three lanes:

```text
Truth Lane → Case Writing Lane → Decision Lane
```

- **Truth Lane:** deterministic normalization, evidence creation, and rules decide what can be verified.
- **Case Writing Lane:** the configured model, or a deterministic fallback, writes a grounded case brief from supplied facts, rules, unknowns, and evidence only.
- **Decision Lane:** a human reviewer approves, rejects, requests evidence, or escalates. AI and deterministic review cannot mutate `human_decision`.

## Architecture

The durable object is a `DecisionCase`:

- input records
- normalized facts
- evidence
- unknowns
- deterministic rule results
- grounded case brief
- human decision
- history

Phase 3.5 adds derived judge-facing intelligence without changing the core schema:

- **Case Readiness:** evidence completeness, policy coverage, unknown count, blocking rules, and ready-for-decision state.
- **Traceability Map:** rule-to-evidence and evidence-to-rule links.
- **Decision Timeline:** readable projection of stored history events.

## Walkthrough

1. Create or seed a demo case.
2. Run deterministic review.
3. Generate a grounded case brief.
4. Inspect readiness, traceability, and timeline.
5. Hand the case to a human decision gate in the next phase.

Example:

```bash
npm start
```

In another shell:

```bash
node scripts/seed-demo-case.js SCN-BANK-MISMATCH
curl -X POST http://127.0.0.1:8787/cases/CASE-2026-0001/deterministic-review
curl -X POST http://127.0.0.1:8787/cases/CASE-2026-0001/case-brief
curl http://127.0.0.1:8787/cases/CASE-2026-0001/readiness
curl http://127.0.0.1:8787/cases/CASE-2026-0001/traceability
curl http://127.0.0.1:8787/cases/CASE-2026-0001/timeline
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
- `GET /cases/:caseId/readiness`
- `GET /cases/:caseId/traceability`
- `GET /cases/:caseId/timeline`

## Run

```bash
npm start
```

The API listens on `PORT` or `8787`.

## Tests

```bash
npm test
```

The tests cover deterministic rules, evidence citation integrity, model-output validation, human-decision immutability, readiness, traceability, timeline, and README product positioning.

## Model Configuration

Deterministic review never calls a model.

The case writer calls a model only when both `OPENAI_API_KEY` and `KLEAR_MODEL_ID` are configured. Without credentials, it produces a deterministic fallback brief so judges can run the project from a fresh clone.

Model identifiers must come from environment or config and must not be hardcoded in source.

## Future Domains

The current demo stays focused on finance approval. The same `DecisionCase` architecture can later support compliance, underwriting, onboarding, maintenance, QA, or submission auditing workflows where evidence, rules, AI explanation, and human accountability must remain separate.
