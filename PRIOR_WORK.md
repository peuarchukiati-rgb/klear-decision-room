# Prior Work Disclosure

Review completed: 2026-07-16

This repository is intended to become a new OpenAI Build Week submission, **KLEAR Decision Room**. Before implementation, the two requested source repositories were inspected:

- Finance Reviewer: https://github.com/peuarchukiati-rgb/kfc-p1-finance-reviewer
- KLEAR: https://github.com/peuarchukiati-rgb/klear

The new product should reuse validated concepts and selected patterns from those projects, while clearly separating sponsor-specific prior work from new Build Week implementation.

## Prior Project: Finance Reviewer

Repository inspected from a fresh clone at `/tmp/kfc-p1-finance-reviewer`.

### Existing Architecture

Finance Reviewer is a compact Python standard-library demo organized around a deterministic review pipeline:

- `generate_dataset.py` creates synthetic finance corpora: vendor master, paid ledger, and incoming batch.
- `reviewer.py` runs deterministic checks over structured line items.
- `rules/rules.json` stores editable rule templates and thresholds.
- `reason_writer.py` calls an AI model only after deterministic findings exist, using those findings as grounded input.
- `build_report.py` renders a human approval view from review results and AI-written reasons.
- `serve.py`, `run_demo.py`, and `demo_resubmit.py` wrap the same pipeline for demo flows.
- `output/review_results.json`, `output/reasons.json`, and `output/audit_log.txt` show the produced review records and audit trail.

The core separation is sound: deterministic code checks money-critical truth, the model writes explanations, and a human signs or rejects.

### Reusable Concepts

- Deterministic duplicate detection against paid ledger anchors.
- In-batch duplicate detection.
- Vendor master lookup as a source of truth.
- Bank-account mismatch detection against approved vendor records.
- Unknown-preserving behavior when a vendor or anchor is missing.
- Rule identifiers attached to every finding.
- Evidence/citation strings attached to every finding.
- Human-gated approval behavior.
- Advisory AI reason, recommendation, and escalation-note generation after rules run.
- Synthetic demo data with seeded scenarios.
- Demo scenario for resubmitting an already-paid invoice.
- Audit trail written during each review run.
- Human-readable report generated from structured review records.
- Handoff packet idea: decision prose plus machine-readable JSON.

### Reusable Data Patterns

The new system can adapt these data patterns, but should rename and generalize them:

- `vendor_master`: approved vendors, bank accounts, status.
- `paid_ledger`: previously processed or paid invoices.
- `incoming_batch`: submitted invoice/request records.
- Rule output with `rule_id`, source input, status, evidence, and recommendation gate.
- Seeded demo cases for clean, duplicate, bank mismatch, and unknown conditions.

### Prior Work to Keep Clearly Separate

The following should remain prior work and should not be copied directly into the new Build Week implementation unless explicitly marked as adapted prior code:

- Sponsor-specific KFC/QSR branding, copy, colors, and submission materials.
- Vietnam/KFC-specific store, approval-level, currency, and line-item assumptions.
- Claude/Anthropic-specific browser or API implementation details.
- The old flat line-item result format as the final data model.
- The static approval-report HTML as the final UX.
- Existing generated demo outputs under `output/`.

### Adaptation Guidance

For KLEAR Decision Room, Finance Reviewer should influence the truth layer, not dictate the product shell. The new implementation should create a persistent decision-case model with versioned case history, structured evidence objects, controlled statuses, rule-result objects, model-configured case briefs, and first-class human decisions.

## Prior Project: KLEAR

Repository inspected from a fresh clone at `/tmp/klear`.

### Existing Architecture

KLEAR is a Vite + React single-page app:

- `src/App.jsx` contains the main UI, prompts, schemas, model calls, state rendering, split/merge loop, theme handling, and sample data.
- `src/Progress.jsx` provides reusable async phase progress UI.
- `src/diff.js` provides pure line-diff helpers for comparing markdown versions.
- `README.md`, `DEVPOST_DRAFT.md`, `DEMO_SCRIPT.md`, and `LAUNCH_POST.md` document the product thesis and demo flow.

The app turns messy team conversation into a canonical shared state, splits that state into per-person companion files, accepts returned handoffs, merges them into the state, bumps a version, and records an update log.

### Reusable Concepts

- Canonical shared state as the durable substrate humans and AI read together.
- Store-first diagnosis: preserve decisions that were made but not written down.
- Unknown preservation: use "not stated in input" rather than guessing.
- Fixed model-output schemas with client-side parsing/validation expectations.
- Split from shared state into per-owner handoff packets.
- Pack Back block that lets work return to the shared state.
- Merge engine that folds a returned handoff into the canonical state.
- Version bump on meaningful state changes.
- Update log/changelog after merge.
- Regeneration of owner-specific handoffs from the updated state.
- Convergence counter for open handoffs.
- Human and AI reading the same portable markdown handoff.
- Input-language matching as a product principle.
- Lightweight progress states for long-running AI calls.

### Reusable UI and Utility Patterns

- Phase-by-phase progress component for AI work.
- Version badge showing live state changes.
- Update log with changed/resolved/added/risk categories.
- Per-owner tabs for generated handoff packets.
- Copy/download controls for markdown handoffs.
- Line-diff utility for comparing text versions.

### Prior Work to Keep Clearly Separate

The following should remain prior work and should not become the new product unchanged:

- KLEAR's Builder Experience / context-drift positioning.
- Chat/transcript-specific I-P-S-D prompt and STORE-gap language as the primary product workflow.
- Companion files for teammates as the final domain model.
- Anthropic direct-browser API calls and Claude-specific model configuration.
- The KLEAR visual identity, sample GlowGod dataset, and submission copy.
- One-file React architecture with prompts embedded in `App.jsx`.

### Adaptation Guidance

For KLEAR Decision Room, KLEAR should influence case continuity, not become the app itself. The new implementation should adapt the split/merge/version/handoff discipline into decision-case state: requester evidence updates, reviewer decisions, next-owner handoffs, case history, and version comparison.

## New OpenAI Build Week Implementation

The following should be created as new work for KLEAR Decision Room:

- Neutral product architecture and branding for KLEAR Decision Room.
- Persistent `DecisionCase` schema with status, version, owners, input records, facts, rule results, unknowns, evidence, AI case brief, human decision, and history.
- Controlled enums for case status, rule-result status, and human decision.
- Evidence model with stable evidence IDs, source metadata, confidence, verification state, and claim-to-evidence tracing.
- Finance approval case workflow implemented as an industry-neutral vertical demo.
- Intake and normalization pipeline for invoice/vendor/ledger/supporting evidence records.
- Deterministic rules engine with the required rule set:
  - R-001 duplicate invoice.
  - R-002 vendor existence.
  - R-003 bank-account match.
  - R-004 amount consistency.
  - R-005 required fields.
  - R-006 previous payment status.
  - R-007 supporting evidence requirement.
- Case writer constrained to supplied facts, rules, unknowns, evidence metadata, policy text, and allowed recommendations, with the model identifier supplied only by environment or configuration.
- Model-output validation that rejects invented evidence IDs, invented rule IDs, unsupported claims, and hard-gate violations.
- Human decision gate with approve, reject, request-evidence, and escalate actions.
- Case versioning/audit service where meaningful changes create new versions.
- Human-readable and machine-readable handoff artifacts for next owners.
- Evaluation lab for deterministic rules, model-grounding checks, citation validity, and recommendation constraints.
- New synthetic vendor, invoice, paid-ledger, and evidence datasets without sponsor-specific names.
- New README, architecture docs, demo script, Devpost notes, and Build Week log.

## Reuse Boundary

Allowed reuse:

- Concepts, data-shape inspiration, state-transition patterns, and small utility ideas documented above.
- Rewritten rule logic that follows the new case schema and rule-result schema.
- Rewritten handoff/versioning flow that follows the new decision-case lifecycle.
- Rewritten progress and version-comparison UI patterns.

Requires explicit attribution if copied or closely adapted:

- Any source code from `reviewer.py`, `reason_writer.py`, `build_report.py`, `serve.py`, `src/App.jsx`, `src/Progress.jsx`, or `src/diff.js`.
- Any prompt text from either prior project.
- Any demo copy, generated output, or submission text.

Not reused:

- Sponsor-specific branding or claims.
- Old project names as product UI labels.
- Old model provider assumptions.
- Old flat review-result records as the final data contract.

## Implementation Rule

No implementation should begin until this prior-work review is complete. Future implementation commits should preserve the boundary:

- `PRIOR_WORK.md` records what came from prior repositories.
- New modules should be named and structured for KLEAR Decision Room.
- Any copied or adapted source should be disclosed in this file with file-level detail.
- New Build Week behavior should be traceable to the KLEAR Decision Room mission: deterministic where truth is checked, AI where the case is written, human where the decision is owned.
