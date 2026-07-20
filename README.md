# KLEAR Decision Room

**Where AI prepares decisions without owning them.**

KLEAR Decision Room turns messy operational evidence into a persistent, auditable, decision lifecycle.

AI prepares the case. Systems verify the facts. Humans own the decision.

The reviewer experiences each `DecisionCase` as a **Living Decision Folder**: one familiar workspace showing the current state, the primary finding, and the next human action. The truth engine, grounded writer, handoff lineage, and immutable history stay linked underneath without being flattened onto one screen.

## The Problem

Most enterprise AI workflows stop at an answer. Real operational decisions need more than an answer: they need facts, evidence, rule outcomes, unknowns, recommendations, human accountability, and a record of what changed over time.

The flagship demo is a finance approval workflow because payment review is easy to judge: duplicate invoices, bank-account mismatches, missing vendors, and missing support all require evidence-backed decisions.

The cost is operational, not theoretical: duplicate payments, vendor impersonation, and rushed approvals turn messy evidence into money leaving the business.

The target user is an AP controller or finance reviewer clearing many invoice decisions per day, where the hard part is not seeing one anomaly but proving what was known, unknown, cited, and decided at the moment of approval.

Traditional ERP/AP systems can route approvals, but KLEAR's wedge is the portable decision record: who decided what, against which evidence version, with AI preparation kept separate from human authority.

## The Decision

KLEAR Decision Room keeps each lane independently verifiable and independently replaceable:

```text
Decision Intake
    ↓
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

- **Decision Intake:** structured handoff packets and messy intake notes both become versioned `DecisionCase` records without granting decision authority.
- **Truth Lane:** deterministic normalization, evidence creation, and rules decide what can be verified.
- **Grounded Case Writer:** the configured model, or a deterministic fallback, writes a grounded case brief from supplied facts, rules, unknowns, and evidence only. Every accepted brief carries a deterministic validation receipt; rejected model output is retried once with validation feedback before a clearly disclosed fallback is used.
- **Human Decision:** a reviewer approves, rejects, requests evidence, or escalates through an explicit decision event.
- **Decision Handoff:** the latest persisted case becomes a two-plane human-readable and machine-readable handoff.
- **Pack Back:** the next owner returns structured updates that merge into the case through a guarded version bump.

The UI presents case briefs, decision handoffs, and pack backs as portable artifacts. A reviewer can open, copy, or download a focused Markdown handoff while raw Markdown and the machine-readable sidecar remain available as advanced detail.

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

1. Open the reviewer console and click **Run Bank-Mismatch Demo** to see deterministic truth verification stop honestly at the disconnected OpenAI lane.
2. Provide a request-scoped OpenAI API key and click **Connect & Run Live** to prepare the grounded brief, block unsafe approval, record a human evidence request, and receive handoff acknowledgement while evidence remains pending.
3. Read the Living Decision Folder's primary finding and next action, then open its evidence, portable handoff artifact, and immutable history.
4. Use **Compare Good vs Messy Intake** to see clean structured input become decision-ready while messy input preserves unknowns instead of guessing.

Example:

```bash
npm start
```

For a clean rehearsal queue before recording, seed four distinct reviewed cases (bank mismatch, duplicate, missing vendor, and clean):

```bash
npm run seed-demo-queue
```

Use `npm run reset-demo` only when you want an empty workspace.

Open the reviewer console:

```text
http://127.0.0.1:8787/
```

Or use the API from another shell. The seed script prints the generated `case_id`; capture it so repeated demo runs do not depend on a hardcoded number.

```bash
CASE_ID=$(node scripts/seed-demo-case.js SCN-BANK-MISMATCH | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>console.log(JSON.parse(s).case_id))")
curl -X POST http://127.0.0.1:8787/cases/$CASE_ID/deterministic-review
curl -X POST http://127.0.0.1:8787/cases/$CASE_ID/case-brief
curl http://127.0.0.1:8787/cases/$CASE_ID/readiness
curl http://127.0.0.1:8787/cases/$CASE_ID/traceability
curl http://127.0.0.1:8787/cases/$CASE_ID/timeline
curl http://127.0.0.1:8787/cases/$CASE_ID/decision-story
```

The reviewer console provides two judge paths: **Run Bank-Mismatch Demo** proves the honest offline stopping point, while **Connect & Run Live** proves the complete operational lifecycle. Manual scenario controls remain available under the demo stage for choosing a specific intake packet.

## API

- `GET /health`
- `GET /demo-intake-packets`
- `POST /intake-packets`
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

## Handoff Protocol

KLEAR uses handoff as a state-transfer protocol, not a loose summary. The protocol is documented in [`docs/handoff-protocol.md`](docs/handoff-protocol.md) so other agents can create, consume, and pack back work without re-deriving context.

## Run

```bash
git clone https://github.com/peuarchukiati-rgb/klear-decision-room.git
cd klear-decision-room
npm install
npm run seed-demo-queue
npm start
```

The API listens on `PORT` or `8787`.

The same server serves the static reviewer console at `/`.

No `.env` file is required to inspect seeded cases or run deterministic truth verification. The API retains a deterministic fallback for resilience and automated testing, while the reviewer console intentionally stops the offline live-demo path before case writing so it never implies that OpenAI was called.

## Public Demo Deployment

Live judge preview:

```text
https://klear-decision-room.onrender.com
```

The repository includes a Render Blueprint for a public Node-hosted demo. Deploy it from:

```text
https://dashboard.render.com/blueprint/new?repo=https://github.com/peuarchukiati-rgb/klear-decision-room
```

The hosted start command seeds the four-case rehearsal queue before starting the API. Render free services use an ephemeral filesystem, so the public demo intentionally resets to that known queue after a restart, redeploy, or idle spin-down. This is a judge-preview boundary, not production persistence.

The bundled model selection is `gpt-5.6` in `config/model.json`. A deployment may use `KLEAR_MODEL_ID` to select another Responses API model that supports the required structured-output schema, without changing application source or exposing model selection in the reviewer UI. Do not configure a shared OpenAI key on the public host; judges provide only their own request-scoped key through the reviewer console.

## Live Model Demo

The reviewer console presents OpenAI as a visible, replaceable case-writing layer. Offline mode verifies deterministic truth and then stops visibly; a judge-provided OpenAI API key unlocks the complete bank-mismatch lifecycle.

1. Open the [public demo](https://klear-decision-room.onrender.com) or `http://127.0.0.1:8787/` locally.
2. In **Model Connection**, paste an OpenAI API key into the visible request-scoped field. KLEAR uses the bundled model configuration; no model selection is required in the reviewer UI.
3. Click **Connect & Run Live**. The Truth Layer remains deterministic, only the Grounded Case Writer calls the model, and the Human Decision lane remains authoritative.
4. Watch the Case Writer state change from red `OpenAI not connected` to `OpenAI live`, then inspect the validation receipt for structured output, evidence citations, rule citations, recommendation gates, and preserved human authority.

The key is sent only from the browser to the API for that one request and cleared from the form after every attempt. It is not stored in `DecisionCase`, version snapshots, handoff artifacts, history, or any file under `storage/`. The public demo is bring-your-own-key and never carries a shared server-side key.

If model output fails validation, KLEAR retries once with the validator's failure reasons. A second rejected output is never displayed as a live brief: the system stores a clearly labeled deterministic fallback with a `PASSED_WITH_FALLBACK` receipt and stops the live reviewer journey.

## Tests

```bash
npm test
```

The tests cover deterministic rules, evidence citation integrity, model-output validation, human-decision immutability, explicit decision transitions, immutable versions, handoff lineage, pack-back guards, readiness, traceability, timeline, Decision Story, reviewer UI smoke coverage, and README product positioning.

## Built With OpenAI

Codex was used throughout Build Week to inspect the prior repositories, implement and test the DecisionCase architecture, build the deterministic truth and human-decision lanes, and iterate on the reviewer experience. GPT-5.6 was used for architecture reasoning, implementation review, and the grounded case-writer path demonstrated in the product.

The product does not hardcode that model into runtime source. The bundled default is `gpt-5.6` in `config/model.json`, with an optional `KLEAR_MODEL_ID` environment override for another compatible Responses API model; the same grounded-output validator and human-decision boundary apply regardless of model size.

## Model Configuration

Deterministic review never calls a model.

The case writer calls a model only when an `OPENAI_API_KEY` is supplied and model configuration resolves successfully. Without credentials, its service-level deterministic fallback remains available for resilience and tests, while the visible offline demo stops before case writing.

For the reviewer console, the API key is supplied per request through the masked field and discarded after the request. The model ID remains bundled/deployment configuration and is never requested from the reviewer.

Model identifiers must come from environment or config and must not be hardcoded in source.

## Future Domains

The current demo stays focused on finance approval. The same `DecisionCase` architecture can later support compliance, underwriting, onboarding, maintenance, QA, or submission auditing workflows where evidence, rules, AI explanation, and human accountability must remain separate.

## License

MIT. See [`LICENSE`](LICENSE).
