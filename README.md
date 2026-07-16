# KLEAR Decision Room

AI prepares the case. Systems verify the facts. Humans own the decision.

This is a new OpenAI Build Week project. Phase 1 created the neutral repository structure, the persistent `DecisionCase` schema, synthetic demo data, and a minimal case API. Phase 2 added the deterministic truth layer. Phase 3 adds the grounded case writer.

## Current Scope

Implemented now:

- Clean project root separate from unrelated workspace files.
- Prior-work disclosure and reuse inventory.
- DecisionCase schema and controlled enums.
- JSON-file persistence.
- Neutral synthetic finance dataset.
- Minimal API to create, save, retrieve, and version a case.
- Invoice normalization into the `DecisionCase` model.
- Evidence object creation with stable evidence IDs.
- Deterministic finance review rules R-001 through R-007.
- API action to run deterministic review for a case.
- Grounded case writer with structured output validation, citation validation, hard-gate enforcement, and deterministic fallback when model credentials are absent.

Deferred intentionally:

- Polished UI.
- Evaluation lab.

## Run

```bash
npm start
```

The API listens on `PORT` or `8787`.

## Minimal API

- `GET /health`
- `POST /cases`
- `GET /cases`
- `GET /cases/:caseId`
- `PUT /cases/:caseId`
- `POST /cases/:caseId/versions`
- `POST /cases/:caseId/deterministic-review`
- `POST /cases/:caseId/case-brief`

## Model Configuration

No model is called by deterministic review. The case writer calls a model only when both `OPENAI_API_KEY` and `KLEAR_MODEL_ID` are configured; otherwise it uses a deterministic fallback brief. Model identifiers must come from environment or config and must not be hardcoded in source.
