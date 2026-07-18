---
protocol: klear-handoff/v1
handoff_id: HANDOFF-KLEAR-20260718-LIVING-FOLDER
source_object_id: klear-decision-room
source_version: edc11a4
source_event_id: SESSION-BRIDGE-LIVING-FOLDER
status: READY_FOR_HUMAN_UX_TEST
current_owner: Peak + Codex
next_owner: Peak or the next reviewing agent
generated_at: 2026-07-18T11:16:58+07:00
---

# Handoff - KLEAR Living Decision Folder

## Why This Exists

This handoff preserves the session where KLEAR Decision Room stopped presenting its entire architecture as one flat UI and found its external product metaphor: a **Living Decision Folder**.

The system was already correct, versioned, and guarded. The problem was that intake, truth, evidence, AI writing, human authority, handoff, pack back, and history were all visible on the same plane. The interface felt messy because it exposed the whole internal logic at once.

The bridge completed in this session was:

```text
Before
Flat architecture viewer containing every system layer

        -> bridge ->

After
Living Decision Folder showing current state and next human action,
with linked system layers available only when needed
```

## Product Model

`DecisionCase` is the canonical living folder.

The reviewer sees:

- what this case is
- what KLEAR found
- whether the case is ready
- what the human must do next
- which portable artifacts are available

The underlying system remains:

```text
Intake
  -> Deterministic Truth and Evidence
  -> Grounded Case Writing
  -> Explicit Human Decision
  -> Decision Handoff
  -> Pack Back
  -> Immutable Versioned History
```

The UI now exposes only four folder sections:

- Overview
- Evidence
- Decide
- History

Grounded Case Brief, Decision Handoff, and Pack Back are no longer large navigation layers. They are portable artifacts in the folder:

- `<case-id>-case-brief.md`
- `<case-id>-decision-handoff.md`
- `pack-back.json`

Artifact viewers show the human-readable document first. Raw Markdown and the machine-readable plane stay collapsed until needed.

## Current State

- Repository: `/Users/peakeuarchukiati/Documents/New project/klear-decision-room`
- Branch: `main`
- Current implementation commit: `edc11a4 Reframe reviewer UI as living decision folder`
- Server: `http://127.0.0.1:8787/` was running at handoff time
- Automated tests: `42/42` passing
- JavaScript syntax check: passing
- Hardcoded model/domain drift scan: clean
- Demo storage: reset, then populated with one completed bank-mismatch walkthrough
- Working tree before this handoff: only `docs/video-narration.md` was untracked and intentionally parked

## What Changed In `edc11a4`

- Rebuilt the static reviewer console as a quiet operational folder workspace.
- Added a case cover showing vendor, invoice, amount, owner, status, and readiness.
- Added a derived `Your next action` projection from persisted case state.
- Added a focused primary-finding panel.
- Kept AI preparation and human authority visually distinct.
- Reduced primary navigation to Overview, Evidence, Decide, and History.
- Added a portable artifact shelf for case brief, handoff, and pack back.
- Added focused artifact dialogs with copy/download/import actions.
- Added `klear-case-brief/v1` and `klear-handoff/v1` metadata to downloaded/copied Markdown.
- Kept raw Markdown and machine-readable handoff data behind advanced disclosure.
- Updated README, demo script, reuse inventory, build log, UI tests, and handoff protocol.
- Added the transport invariant: downloading a `.md`, opening it, or pasting its complete body into a fresh agent session must preserve the same meaning.

## Preserved Invariants

- `human_decision_events` is the canonical human decision history.
- `human_decision` is only the latest convenience snapshot.
- Deterministic review and the case writer cannot mutate either human-decision field.
- `APPROVED`, `REJECTED`, and `CLOSED` require explicit human decision events.
- Version snapshots are immutable.
- Readiness, traceability, timeline, Decision Story, and handoff are reproducible projections of persisted `DecisionCase` state.
- Model ID comes from request/config/environment only.
- No source code from Finance Reviewer or prior KLEAR was copied.
- Finance Reviewer remains truth-layer influence only.
- Prior KLEAR remains continuity/handoff influence only.
- Do not pivot toward unrelated domains.

## Verification Evidence

Browser validation was performed against the running local application:

- clean workspace rendered with zero cases
- one-click Bank-Mismatch Demo completed end to end
- unsafe approval was rejected by the guarded human-decision API
- final case remained `EVIDENCE_REQUIRED`
- next action remained `Collect the requested evidence`
- final proof copy stated that AI prepared the case but never closed it
- timeline showed case creation, deterministic review, grounded brief, human decision, and pack back in order
- Evidence section rendered 7 rule rows and 16 evidence rows for the demo case
- handoff artifact showed source version and decision-event lineage
- grounded brief artifact showed summary, risk, disposition, missing information, and citations
- desktop layout rendered without the previous raw JSON wall
- mobile layout was checked at 390 x 844 with no horizontal overflow
- browser console reported no errors or warnings during the full demo run

## Known Unknowns

- Peak has not yet completed the final subjective by-hand/by-eye judge walkthrough of this exact committed UI.
- The parked `docs/video-narration.md` still describes the previous UI wording and must not be treated as current until the human UX gate passes.
- The approval-block attempt remains a live demo event, not a persisted timeline event. Capture it at the moment it occurs if it is used in the video.
- Repeated demo clicks create additional synthetic cases. Use `npm run reset-demo` before a clean rehearsal or recording.

## Required Next Action

Peak should test the committed product as a first-time reviewer:

```bash
cd "/Users/peakeuarchukiati/Documents/New project/klear-decision-room"
npm run reset-demo
npm start
```

Then:

1. Open `http://127.0.0.1:8787/`.
2. Click `Run Bank-Mismatch Demo`.
3. Read the case without trying to remember the architecture.
4. Confirm that the next action is obvious.
5. Open Evidence, Decide, and History.
6. Open, copy, or download the Case Brief and Decision Handoff artifacts.
7. Report only three things: what felt clear, what remained confusing, and what felt unnecessary.

After that human test:

- make at most one focused UX adjustment if needed
- rerun tests and browser validation
- freeze product code
- update the parked narration and begin the video pipeline

Do not add another product layer, workflow engine, domain, or backend abstraction before this gate.

## Pack Back

Return the human UX result using this shape:

```json
{
  "source_object_id": "klear-decision-room",
  "source_version": "edc11a4",
  "handoff_id": "HANDOFF-KLEAR-20260718-LIVING-FOLDER",
  "responding_actor": {
    "role": "PRODUCT_OWNER",
    "name": "Peak"
  },
  "event_type": "DECISION_RESPONSE",
  "completed_actions": [
    "Completed the first-time reviewer walkthrough"
  ],
  "clear_moments": [],
  "confusing_moments": [],
  "unnecessary_elements": [],
  "decision": "FREEZE_OR_ADJUST",
  "note": "",
  "timestamp": ""
}
```

## Machine-Readable Plane

```json
{
  "protocol": "klear-handoff/v1",
  "handoff_id": "HANDOFF-KLEAR-20260718-LIVING-FOLDER",
  "handoff_type": "PROJECT_SESSION_HANDOFF",
  "source_object_id": "klear-decision-room",
  "source_version": "edc11a4",
  "source_event_id": "SESSION-BRIDGE-LIVING-FOLDER",
  "status": "READY_FOR_HUMAN_UX_TEST",
  "current_owner": "Peak + Codex",
  "next_owner": "Peak or the next reviewing agent",
  "verified": {
    "tests_passed": 42,
    "tests_failed": 0,
    "desktop_browser_checked": true,
    "mobile_browser_checked": true,
    "full_demo_loop_checked": true,
    "console_errors": 0,
    "human_visual_gate_complete": false
  },
  "required_actions": [
    "Complete first-time human reviewer walkthrough",
    "Return clear, confusing, and unnecessary moments",
    "Freeze or make one focused UX adjustment",
    "Only then resume video production"
  ],
  "protected_files": [
    "docs/video-narration.md"
  ],
  "pack_back_expected": true
}
```
