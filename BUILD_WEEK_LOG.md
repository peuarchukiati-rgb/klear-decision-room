# Build Week Log

## 2026-07-16

- Reviewed prior work from Finance Reviewer and KLEAR before implementation.
- Created `PRIOR_WORK.md` and `REUSE_INVENTORY.md`.
- Created clean `klear-decision-room` root because the parent workspace contains unrelated untracked files.
- Began Phase 1 only: schema, persistence, neutral demo data, and minimal case API.
- Tagged disclosure-only baseline as `build-week-baseline`.
- Verified Phase 1 with `npm test`.
- Began Phase 2 only: deterministic invoice normalization, evidence creation, configurable finance rules, and API review action.
- Added tests for clean, duplicate, bank mismatch, missing vendor, missing supporting evidence, rule citation discipline, and API deterministic review.
- Tightened deterministic review invariant so terminal human-decision states cannot be produced by deterministic review.
- Began Phase 3 only: grounded case writer, structured output validation, citation validation, hard-gate enforcement, fallback brief, and API case-brief action.
- Verified Phase 3 with `npm test`.
- Added pre-Phase 4 hardening: product-first README, case readiness, traceability map, decision timeline, and stricter human-decision immutability tests.
- Began Phase 4 only: reviewer experience, explicit human decision service, Decision Handoff, Pack Back, immutable version snapshots, and Decision Story.
- Added `human_decision_events` as canonical decision history and kept `human_decision` as a latest-event convenience snapshot.
- Added guarded human actions for approve, reject, request evidence, and escalate.
- Added two-plane handoff lineage with `handoff_id`, source case version, and source decision event.
- Added guarded pack-back import with stale-version conflict handling and no human-decision mutation path.
- Added static no-dependency reviewer console served by the API.
- Verified Phase 4 with `npm test`.
- Tightened judge demo flow: README/demo script now capture generated case IDs, console visually separates AI-prepared brief from authoritative human decision, and escalation errors name the required fields.
- Added in-console bring-your-own-key live model case-brief generation with request-scoped credentials, live/fallback badge, and tests confirming API keys are not persisted.
- Added Phase 4.1 intake runway: structured handoff and messy intake packet import, demo packet API, reviewer-console lifecycle controls, and docs for intake-driven demos.
- Added guided payment review simulation mode so the first screen presents the finance cutoff scenario, one-click bank-mismatch proof path, and good-vs-messy intake comparison.
- Tightened guided demo ending so Pack Back is framed as handoff acknowledgement with evidence pending, preserving the thesis that the payment remains blocked until human-confirmed evidence arrives.
- Reframed the reviewer console as a Living Decision Folder: current state, primary finding, and next human action stay visible while evidence and immutable history remain focused folder sections.
- Moved grounded briefs, decision handoffs, and pack backs into portable artifact views with copy/download affordances, protocol metadata, and collapsed raw Markdown/machine-readable detail.
- Completed a visual compression pass: made Finance Approval explicit as the current workspace, collapsed demo controls after intake, removed duplicate status and authority panels, reduced artifact chrome, and kept one dominant next action.
- Added a deterministic four-case demo queue with bank mismatch as the hero, followed by duplicate, missing-vendor, and clean scenarios.
- Added a two-beat fresh-session introduction and a restrained Run Demo cue so judges enter the finance decision through one concrete Friday cutoff story.
- Made blocked approval attempts auditable as versioned history events while preserving status, `human_decision`, and canonical `human_decision_events` unchanged.
- Changed the topbar demo control into a high-contrast one-click `Run Demo` action and made `Refresh` reset only the presentation state to the blank post-intro workspace without deleting cases or audit history.
- Cleared request-scoped API keys from the reviewer form and in-memory credential state immediately after successful case-brief generation while retaining the configured model ID.
- Added a Render Blueprint and hosted start path for a public judge-preview URL, with explicit ephemeral-state disclosure, automatic demo-queue seeding on service start, and no shared provider key on the host.
# 2026-07-19 - Public judge preview

- Deployed the Render Blueprint at `https://klear-decision-room.onrender.com`.
- Verified the public `/health`, `/cases`, and reviewer-console routes against the live service.
- Kept the hosted environment free of shared model credentials; fallback and request-scoped BYO-key paths remain available.

# 2026-07-20 - Visible model connection

- Promoted the request-scoped OpenAI key and model ID fields from a nested brief artifact into a visible workspace-level Model Connection layer.
- Made the replaceable architecture explicit in the UI: deterministic Truth Layer, optional live/fallback Case Writer, and authoritative Human Decision remain separate.
- Connected both `Run Offline Demo` and `Connect & Run Live` to the same bank-mismatch lifecycle so the model changes without changing truth or decision guardrails.
- Preserved automatic API-key clearing after every live attempt and verified the offline loop in isolated demo storage.
- Removed model-ID entry and model-slug presentation from the reviewer UI; the deployment now owns `KLEAR_MODEL_ID` while reviewers provide only a request-scoped OpenAI API key.
- Changed the offline judge path to stop visibly after deterministic truth verification, before case writing or any new human-decision/handoff event, so offline resilience is never presented as a live OpenAI run.
- Matched the prior KFC/KLEAR key-only interaction pattern by moving the default OpenAI model selection into `config/model.json`; reviewers now supply only an API key, while deployments may still override the model through `KLEAR_MODEL_ID`.
- Added observable processing states across the guided lifecycle: the active lane, request button, and plain-language activity line now show what operation is running without exposing or fabricating model reasoning.
- Set the bundled case-writer default to the config-owned `gpt-5.6` alias while preserving `KLEAR_MODEL_ID` overrides for compatible Responses API models.
- Added a persisted case-writer validation receipt plus one validation-feedback retry; a second rejected model output produces a clearly labeled deterministic fallback and stops the live UI journey.
- Added an MIT license for the public submission repository.
- Added config-owned GPT-5.6-first compatibility negotiation so request-scoped API keys can use the first accessible configured model without exposing a model selector.
- Sanitized OpenAI provider errors before they reach the reviewer UI; project identifiers and raw upstream response bodies are never displayed or persisted.
- Added reviewer-first progressive disclosure before recording: model setup now opens in a focused dialog, the live proof log is collapsed by default, and the Overview leads with the blocking finding, cited evidence comparison, grounded disposition, and next human action.
- Consolidated readiness, model validation, portable files, normalized facts, unknowns, and full rule results under one reproducible `Audit details` layer without changing DecisionCase state or lane boundaries.
- Restored the OpenAI key panel and Technical run log as always-visible action/proof surfaces after hands-on review; deeper case intelligence remains progressively disclosed under the reviewer-first workspace.
