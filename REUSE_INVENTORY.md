# Reuse Inventory

Created: 2026-07-16
Last updated: 2026-07-18

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
| `kfc-p1-finance-reviewer/build_report.py` | Concept reference | `packages/handoff/src/handoffGenerator.js` | Human + machine handoff idea reused; implementation is newly written with Phase 4 lineage fields. |
| `kfc-p1-finance-reviewer/output/*` | Not reused | None | Generated outputs are prior work and excluded. |
| `klear/README.md` | Concept reference | `README.md`, `docs/architecture.md` | Canonical-state and living-handoff concepts reused, rewritten for decision cases. |
| `klear/src/App.jsx` | Concept reference | `packages/case-store/src/caseStore.js`, `packages/handoff/src/handoffGenerator.js`, `packages/human-decision/src/packBackService.js` | Version bump, update log, split/merge/handoff continuity ideas reused. No React code or prompts copied. |
| `klear/src/Progress.jsx` | Not reused | None | Reviewer console is newly written as static no-dependency UI. No progress UI implementation copied. |
| `klear/src/diff.js` | Not reused | None | Version snapshots and history are newly implemented without copying diff utility code. |
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
| `packages/intake/src/index.js` | New intake package barrel export. |
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

## Phase 4 New Files

| Destination | New work description |
| --- | --- |
| `packages/human-decision/src/humanDecisionService.js` | New explicit human decision workflow with action validation, transition guards, canonical decision events, and latest snapshot derivation. |
| `packages/human-decision/src/packBackService.js` | New guarded Pack Back importer with field whitelist, version conflict handling, evidence merge, and human-decision mutation block. |
| `packages/case-insights/src/decisionStory.js` | New derived Decision Story projection from persisted `DecisionCase` state. |
| `apps/web/index.html` | New static reviewer console shell. |
| `apps/web/styles.css` | New restrained operational reviewer console styling. |
| `apps/web/app.js` | New browser-side reviewer workflow using the local API. |
| `tests/humanDecision.test.js` | New tests for human decision events, transition guards, immutable snapshots, handoff lineage, and Pack Back. |
| `tests/reviewerUi.test.js` | New static UI smoke tests for Phase 4 panels and routes. |
| `docs/demo-script.md` | New judge-facing lifecycle demo script. |

## Phase 4.1 New Files

| Destination | New work description |
| --- | --- |
| `packages/intake/src/intakePacketImporter.js` | New deterministic intake packet importer for structured handoff packets and messy notes, with human-decision bypass guards. |
| `docs/demo-intake/structured-bank-mismatch.md` | New example of a protocol-shaped structured finance handoff packet. |
| `docs/demo-intake/messy-missing-vendor.txt` | New example of unstructured intake text that becomes explicit unknowns after review. |
| `apps/api/src/server.js` | Extended with demo intake packet listing and intake import routes. |
| `apps/web/index.html` | Extended with guided payment review simulation copy, intake controls, and one-click proof controls. |
| `apps/web/app.js` | Extended with import, review, brief, guardrail, handoff, pack-back, one-click proof, and good-vs-messy comparison actions. |
| `apps/web/styles.css` | Extended with operational styling for the intake runway and lifecycle steps. |
| `scripts/reset-demo-storage.js` | New local rehearsal helper that clears generated demo case storage without touching source files. |

## Living Decision Folder UI Pass

| Destination | New work description |
| --- | --- |
| `apps/web/index.html` | Reframed the operational console as a Living Decision Folder with focused overview, evidence, decision, and history sections plus portable artifact viewers. |
| `apps/web/app.js` | Added derived current-state, primary-finding, next-action, artifact-document, and handoff-lineage presentation without creating a new source of truth. |
| `apps/web/styles.css` | Added the newly written folder workspace, artifact shelf, focused document viewer, and responsive mobile presentation. No prior UI source code copied. |
| `tests/reviewerUi.test.js` | Updated smoke coverage for the Living Decision Folder and portable artifact boundary. |

## Current Reuse Boundary

- `source_code_copied`: none
- `prompt_text_copied`: none
- `generated_outputs_copied`: none
- `branding_copied`: none
- `concepts_reused`: Finance Reviewer truth-layer discipline; KLEAR continuity/version/handoff discipline
