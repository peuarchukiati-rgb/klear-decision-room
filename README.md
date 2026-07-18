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
- **Grounded Case Writer:** the configured model, or a deterministic fallback, writes a grounded case brief from supplied facts, rules, unknowns, and evidence only.
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

1. Open the reviewer console and click **Run Bank-Mismatch Demo**.
2. Watch KLEAR import intake, run deterministic truth review, prepare a grounded brief, block unsafe approval, record a human evidence request, and receive handoff acknowledgement while evidence remains pending.
3. Read the Living Decision Folder's primary finding and next action, then open its evidence, portable handoff artifact, and immutable history.
4. Use **Compare Good vs Messy Intake** to see clean structured input become decision-ready while messy input preserves unknowns instead of guessing.

Example:

```bash
npm start
```

For a clean rehearsal inbox before recording:

```bash
npm run reset-demo
```

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

The reviewer console provides the fastest judge path: click **Run Bank-Mismatch Demo** for a one-click operational proof. Manual scenario controls remain available under the demo stage for choosing a specific intake packet and stepping through the same lifecycle.

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
npm start
```

The API listens on `PORT` or `8787`.

The same server serves the static reviewer console at `/`.

No `.env` file is required for the demo path. Without model credentials, the case writer uses a deterministic fallback so the full reviewer workflow still runs from a fresh clone.

## Live Model Demo

The reviewer console also supports a bring-your-own-key live model run for judges who want to see the grounded case writer call a model without restarting the server.

1. Open `http://127.0.0.1:8787/`.
2. Select a reviewed case.
3. Open the `case-brief.md` artifact, expand **Generate with a configured model**, and paste an OpenAI API key and a `Model ID`.
4. Use the smallest suitable model to prove the architecture, not model size, carries the trust boundary.
5. Click **Generate Brief** and watch the badge change from `OFFLINE BRIEF` to `LIVE MODEL`.

The key is sent only from the browser to the local API for that one request. It is not stored in `DecisionCase`, version snapshots, handoff artifacts, history, or any file under `storage/`. This is a localhost demo convenience, not a hosted secret-management flow.

## Tests

```bash
npm test
```

The tests cover deterministic rules, evidence citation integrity, model-output validation, human-decision immutability, explicit decision transitions, immutable versions, handoff lineage, pack-back guards, readiness, traceability, timeline, Decision Story, reviewer UI smoke coverage, and README product positioning.

## Model Configuration

Deterministic review never calls a model.

The case writer calls a model only when both `OPENAI_API_KEY` and `KLEAR_MODEL_ID` are configured. Without credentials, it produces a deterministic fallback brief so judges can run the project from a fresh clone.

For the reviewer console, those same credentials can be supplied per request through the masked API-key field and model-id field. Per-request credentials are discarded after the request.

Model identifiers must come from environment or config and must not be hardcoded in source.

## Future Domains

The current demo stays focused on finance approval. The same `DecisionCase` architecture can later support compliance, underwriting, onboarding, maintenance, QA, or submission auditing workflows where evidence, rules, AI explanation, and human accountability must remain separate.
