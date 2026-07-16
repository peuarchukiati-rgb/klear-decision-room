# KLEAR Decision Room

AI prepares the case. Systems verify the facts. Humans own the decision.

This is a new OpenAI Build Week project. Phase 1 creates the neutral repository structure, the persistent `DecisionCase` schema, synthetic demo data, and a minimal case API.

## Phase 1 Scope

Implemented now:

- Clean project root separate from unrelated workspace files.
- Prior-work disclosure and reuse inventory.
- DecisionCase schema and controlled enums.
- JSON-file persistence.
- Neutral synthetic finance dataset.
- Minimal API to create, save, retrieve, and version a case.

Deferred intentionally:

- Rules engine.
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

## Model Configuration

No model is called in Phase 1. Future model IDs must come from environment or config, such as `KLEAR_MODEL_ID`; model identifiers must not be hardcoded in source.
