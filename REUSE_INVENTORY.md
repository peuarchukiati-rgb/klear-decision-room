# Reuse Inventory

Created: 2026-07-16
Last updated: 2026-07-16

This file records file-level reuse decisions for the current KLEAR Decision Room implementation. Prior repositories are used as architecture, product, and data-shape influence only. No source code, prompts, generated outputs, UI copy, sponsor-specific branding, or demo assets are copied from either prior repository.

| Source | Reuse type | Destination | Attribution |
| --- | --- | --- | --- |
| `kfc-p1-finance-reviewer/README.md` | Concept reference | `README.md`, `docs/architecture.md` | Prior Finance Reviewer thesis: deterministic checks before AI explanation; rewritten for KLEAR Decision Room. |
| `kfc-p1-finance-reviewer/reviewer.py` | Concept reference | `packages/rules-engine/src/financeRules.js`, `packages/rules-engine/src/reviewService.js` | Prior truth-layer pattern only. No source code copied. |
| `kfc-p1-finance-reviewer/rules/rules.json` | Data-shape reference | `data/policies/finance-approval-policy.json` | Rule IDs and deterministic rule-template idea adapted as neutral policy metadata. No JSON copied. |
| `kfc-p1-finance-reviewer/data/vendor_master.json` | Data-model reference | `data/demo/vendor-master.json` | Vendor-master concept reused with new neutral synthetic vendors and fields. |
| `kfc-p1-finance-reviewer/data/paid_ledger.json` | Data-model reference | `data/demo/paid-ledger.json` | Paid-ledger anchor concept reused with new neutral synthetic records. |
| `kfc-p1-finance-reviewer/data/incoming_batch.json` | Scenario reference | `data/demo/demo-invoices.json`, `data/demo/scenarios.json` | Scenario shape reused as finance demo inspiration; records are newly authored. |
| `kfc-p1-finance-reviewer/reason_writer.py` | Boundary reference | `packages/case-writer/src/*`, `src/config/modelConfig.js` | AI-as-case-writer boundary reused. KLEAR Decision Room implements a newly written OpenAI Responses API case writer with structured output validation, env/config model IDs, and deterministic fallback. No source code copied. |
| `kfc-p1-finance-reviewer/build_report.py` | Concept reference | `packages/handoff/src/handoffGenerator.js` | Human + machine handoff idea reused; implementation is newly written. |
| `kfc-p1-finance-reviewer/output/*` | Not reused | None | Generated outputs are prior work and excluded. |
| `klear/README.md` | Concept reference | `README.md`, `docs/architecture.md` | Canonical-state and living-handoff concepts reused, rewritten for decision cases. |
| `klear/src/App.jsx` | Concept reference | `packages/case-store/src/caseStore.js`, `packages/handoff/src/handoffGenerator.js` | Version bump, update log, split/merge/handoff continuity ideas reused. No React code or prompts copied. |
| `klear/src/Progress.jsx` | Future UI pattern reference | No current destination | Async progress UI remains reserved for a future reviewer experience. No UI implementation copied. |
| `klear/src/diff.js` | Future utility reference | No current destination | Version comparison idea remains reserved for future case-history comparison. No source code copied. |
| `klear/DEVPOST_DRAFT.md` | Not reused | None | Submission copy is prior work and excluded. |
| `klear/DEMO_SCRIPT.md` | Not reused | None | Demo script is prior work and excluded. |

## Phase 1 New Files

| Destination | New work description |
| --- | --- |
| `packages/case-schema/src/enums.js` | New controlled enums for decision cases, rule results, human decisions, owners, evidence, and history. |
| `packages/case-schema/src/decisionCase.js` | New DecisionCase factory and validation helpers. |
| `packages/case-store/src/caseStore.js` | New JSON-file persistence with create, save, retrieve, and version operations. |
| `packages/handoff/src/handoffGenerator.js` | New basic handoff artifact serializer from a case object. |
| `apps/api/src/server.js` | New minimal HTTP API. |
| `data/demo/*` | New neutral synthetic finance demo dataset. |
| `docs/*` | New KLEAR Decision Room architecture and decision-model notes. |

## Phase 2 New Files

| Destination | New work description |
| --- | --- |
| `packages/intake/src/invoiceNormalizer.js` | New structured-input normalizer that writes facts, unknowns, and invoice-field evidence. |
| `packages/evidence/src/evidenceFactory.js` | New stable evidence ID and evidence object helpers. |
| `packages/rules-engine/src/financeRules.js` | New deterministic finance rules R-001 through R-007, influenced by Finance Reviewer concepts but not copied. |
| `packages/rules-engine/src/reviewService.js` | New review orchestration that versions cases without mutating human decisions. |
| `tests/deterministicReview.test.js` | New automated coverage for every scenario and deterministic rule behavior. |

## Phase 3 New Files

| Destination | New work description |
| --- | --- |
| `packages/case-writer/src/caseBriefSchema.js` | New structured case-brief JSON schema. |
| `packages/case-writer/src/promptBuilder.js` | New grounded prompt payload builder constrained to stored case data. |
| `packages/case-writer/src/caseBriefValidator.js` | New validator for citations, allowed recommendations, and hard-gate behavior. |
| `packages/case-writer/src/openAiCaseWriterClient.js` | New OpenAI Responses API client using model ID from config only. |
| `packages/case-writer/src/fallbackCaseBrief.js` | New deterministic fallback brief for no-credential demo/test operation. |
| `packages/case-writer/src/caseWriterService.js` | New service that versions only `ai_case_brief` and preserves human decisions. |
| `tests/caseWriter.test.js` | New tests for grounded citations, hard-gate rejection, fallback writing, and env-configured model ID. |

## Phase 3.5 New Files

| Destination | New work description |
| --- | --- |
| `packages/case-insights/src/readiness.js` | New derived case readiness calculation from current case state and policy. |
| `packages/case-insights/src/traceability.js` | New lightweight rule/evidence traceability projection. |
| `packages/case-insights/src/timeline.js` | New decision timeline projection from existing case history. |
| `tests/caseInsights.test.js` | New tests for readiness, traceability, and timeline behavior. |
| `tests/readme.test.js` | New tests for product-first README positioning and anti-pivot wording. |
| `tests/helpers/assertions.js` | New shared assertion helper for human-decision immutability checks. |
| `packages/rules-engine/src/reviewService.js` | Runtime guard that prevents deterministic review from producing human-decision terminal statuses. |
| `packages/case-writer/src/caseBriefValidator.js` | Runtime guard that rejects unsupported model-output fields, including attempts to write `human_decision`. |

## Current Reuse Boundary

- `source_code_copied`: none
- `prompt_text_copied`: none
- `generated_outputs_copied`: none
- `branding_copied`: none
- `concepts_reused`: Finance Reviewer truth-layer discipline; KLEAR continuity/version/handoff discipline
