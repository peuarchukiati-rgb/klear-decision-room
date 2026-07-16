# KLEAR Decision Room

AI prepares the case. Systems verify the facts. Humans own the decision.

This is a new OpenAI Build Week project. Phase 1 created the neutral repository structure, the persistent `DecisionCase` schema, synthetic demo data, and a minimal case API. Phase 2 adds the deterministic truth layer.

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

Deferred intentionally:

- GPT case writer.
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

## Model Configuration

No model is called by deterministic review. Future model IDs must come from environment or config, such as `KLEAR_MODEL_ID`; model identifiers must not be hardcoded in source.
