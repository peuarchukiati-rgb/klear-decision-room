# Handoff: In-Console Live Model Input (Bring-Your-Own-Key)

Owner: next builder (Codex / configured model)
Date: 2026-07-16
Status: ready to implement
Related commit baseline: `b6efd57 Tighten phase 4 judge demo flow`

## Goal

Let a judge paste an OpenAI API key + model id directly into the reviewer console and
generate a **live** grounded case brief — no shell, no env var, no restart. Same
convenience pattern used in the KFC and KLEAR demos.

Then demonstrate the thesis by running the live brief with the **smallest / cheapest
model available**. The point is not "we call a big model." The point is: even a tiny
model's output is still deterministically grounded, citation-validated, and structurally
forbidden from owning the decision. Trust lives in the architecture, not the model. This
is the model-agnostic-OS thesis made visible on camera.

## Why this matters (judge lens)

- Today `POST /case-brief` runs the deterministic **fallback** unless `OPENAI_API_KEY`
  and `KLEAR_MODEL_ID` are set in the process env before `npm start`. Most judges will
  never do that, so they never see a real model call — the demo looks like a mail-merge.
- A key field turns the hidden real-model path into a one-paste, on-screen event.
- Smallest-model run = the Novelty proof: validator still rejects fake citations, hard
  gate still blocks APPROVE. The guardrail, not the model, is the product.

## Current wiring (verified — build on these seams, do not rewrite)

- `packages/case-writer/src/caseWriterService.js:15` — `writeGroundedCaseBrief(store, caseId, { env = process.env, allowFallback, modelOutput })`.
  Already reads credentials from the passed `env`: `env.OPENAI_API_KEY` (line 36) and
  `getModelConfig(env).model_id` from `KLEAR_MODEL_ID` (line 29). **This is the injection point.**
- `packages/case-writer/src/openAiCaseWriterClient.js:21` — `callOpenAiCaseWriter({ model_id, api_key, messages })`. Already parameterized. No change needed.
- `src/config/modelConfig.js` — `getModelConfig(env)` returns `{ model_id, source }` from `env.KLEAR_MODEL_ID`.
- `apps/api/src/server.js:215` — the `case-brief` route currently calls
  `writeGroundedCaseBrief(store, caseBriefCaseId)` with **no options**, so it is locked to
  `process.env`. This is the one call to change.

## Implementation

### 1. Server — accept per-request key/model, override env (non-persistent)

In `apps/api/src/server.js` case-brief route (~line 215):

- Parse the POST body for optional `api_key` and `model_id`.
- Build a request-scoped env override and pass it through — do NOT mutate `process.env`:

```js
const body = await readBody(req); // reuse existing body reader used by /decisions, /pack-back
const env = {
  ...process.env,
  OPENAI_API_KEY: body.api_key || process.env.OPENAI_API_KEY,
  KLEAR_MODEL_ID: body.model_id || process.env.KLEAR_MODEL_ID,
};
const result = await writeGroundedCaseBrief(store, caseBriefCaseId, { env });
```

- If neither body nor env supplies credentials, behavior is unchanged: deterministic
  fallback (`allowFallback` default stays as-is). Fresh-clone path must keep working.
- The request-scoped `env` object is discarded when the request ends. The key is never
  stored on the case, never written to any version snapshot or history event, never
  persisted to `storage/`.

### 2. Reviewer console — key + model input

In `apps/web/index.html` / `app.js`, near the case-brief action:

- Add two fields: `API Key` (`<input type="password">`, masked) and `Model ID`
  (text, with a short helper note: "use your smallest model to prove the guardrails hold").
- Hold both values in a plain in-memory JS variable for the session only. Send them in
  the `POST /case-brief` JSON body.
- Show which path ran using the existing response fields `case_writer.mode` and
  `case_writer.model_called` (route already returns them, server.js:220-222). Render a
  visible badge: `LIVE MODEL: <model_id>` vs `FALLBACK (no key)`. This badge is the demo's
  money shot.

### 3. Security guardrails (hard requirements)

- Input type must be `password`; never echo the key in visible DOM text or the badge.
- Never `console.log` / `stdout` the key on client or server.
- Never write the key into: the `DecisionCase`, `human_decision_events`, version
  snapshots, handoff artifacts, or any file under `storage/`. Grep the case JSON after a
  live run to confirm absence.
- Clear the in-memory key on page unload / on an explicit "Clear key" button.
- `.gitignore` already covers `storage/*.json`; do not add any `.env` with a real key.
- Localhost-only demo: key travels browser → local API over `127.0.0.1`. Acceptable for
  the demo; state this scope in the README section.

## Demo narrative (smallest-model flex)

1. Open console, bank-mismatch case loaded. Brief starts as `FALLBACK (no key)`.
2. Paste key, set the **smallest** model id, regenerate → badge flips to `LIVE MODEL`.
3. Point out the brief was written by a tiny model — then break it:
   - feed a model brief citing `EV-FAKE-001` → `MODEL_OUTPUT_REJECTED`
     (`packages/case-writer/src/caseBriefValidator.js`).
   - APPROVE the bank-mismatch case → rejected by hard gate
     (`packages/human-decision/src/humanDecisionService.js:65`).
4. Line: "The model is small and untrusted. The grounding, the citation check, and the
   human-only decision boundary do not care which model wrote this. Swap the runtime —
   the guarantees hold." (model-agnostic OS thesis)

## Tests to add

- `POST /case-brief` with `api_key` + `model_id` in body routes to model path
  (use an injected `fetchImpl` / mock so no real network call in CI) and returns
  `case_writer.model_called: true`.
- `POST /case-brief` with no key still returns fallback (`model_called: false`) — protects
  the fresh-clone guarantee.
- Regression: after a live-path run, assert the persisted case JSON contains no
  `api_key` / key substring anywhere.
- Keep `npm test` green (currently 39/39).

## Acceptance criteria

- Judge can generate a live brief from the console with zero terminal steps.
- Badge visibly distinguishes LIVE vs FALLBACK.
- Smallest-model live run still triggers fake-citation rejection and hard-gate block.
- No key on disk, in logs, or in any persisted case artifact.
- README updated: BYO-key demo steps + the localhost security scope note.
- Tests updated and green.
