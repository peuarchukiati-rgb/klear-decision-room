# Demo Script: Operational Decision Lifecycle

Use one case to show the full loop:

```text
Messy Input
↓
Truth
↓
Grounded AI
↓
Human Decision
↓
Decision Handoff
↓
Pack Back
↓
Versioned History
↓
Ready for the Next Decision
```

## Setup

```bash
npm start
```

Open:

```text
http://127.0.0.1:8787/
```

In another shell, seed a case:

```bash
node scripts/seed-demo-case.js SCN-BANK-MISMATCH
```

## Walkthrough

1. Open the Case Inbox and select the seeded case.
2. Run deterministic review:

```bash
curl -X POST http://127.0.0.1:8787/cases/CASE-2026-0001/deterministic-review
```

3. Prepare the grounded case brief. This works without model credentials through the deterministic fallback.

```bash
curl -X POST http://127.0.0.1:8787/cases/CASE-2026-0001/case-brief
```

4. Refresh the reviewer console.
5. Inspect normalized facts, readiness, rule results, unknowns, traceability, and Decision Timeline.
6. Submit `REQUEST_EVIDENCE` with reviewer identity, reason, and required evidence.
7. Open the Handoff view and inspect Markdown plus JSON. Point out:
   - `handoff_id`
   - `generated_from_case_version`
   - `generated_from_decision_event`
8. Open Pack Back and import the seeded return update.
9. Inspect Versions, Decision Story, and Timeline through the API:

```bash
curl http://127.0.0.1:8787/cases/CASE-2026-0001/versions
curl http://127.0.0.1:8787/cases/CASE-2026-0001/decision-story
```

10. State the thesis: deterministic systems verify facts, AI prepares a grounded case, and humans own decisions through explicit events.

## Optional Clean Approval Path

For a direct approval demo:

```bash
node scripts/seed-demo-case.js SCN-CLEAN
curl -X POST http://127.0.0.1:8787/cases/CASE-2026-0002/deterministic-review
curl -X POST http://127.0.0.1:8787/cases/CASE-2026-0002/case-brief
```

Then approve in the reviewer console and inspect the generated Decision Handoff.
