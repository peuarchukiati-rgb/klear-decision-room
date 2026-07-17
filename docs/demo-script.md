# Demo Script: Operational Decision Lifecycle

Use one case to show the full loop:

```text
Structured Handoff or Messy Intake
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

Primary path: use the **Start a Decision Lifecycle** runway in the reviewer console.

1. Choose `STRUCTURED · SCN-BANK-MISMATCH` to show a good handoff that still contains a payment blocker, or choose `MESSY · SCN-MISSING-VENDOR` to show unstructured intake becoming explicit unknowns.
2. Click **Import Intake**.
3. Click **Run Truth Review**.
4. Click **Prepare Brief**.
5. Click **Try Blocked Approve** to prove AI and shortcuts cannot approve an evidence-required case.
6. Click **Request Evidence**.
7. Click **Open Handoff**.
8. Click **Import Pack Back**.

API fallback: in another shell, seed a case:

```bash
CASE_ID=$(node scripts/seed-demo-case.js SCN-BANK-MISMATCH | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>console.log(JSON.parse(s).case_id))")
echo $CASE_ID
```

## Walkthrough

1. Open the Case Inbox and select the imported or seeded case.
2. Run deterministic review if you are using the API path:

```bash
curl -X POST http://127.0.0.1:8787/cases/$CASE_ID/deterministic-review
```

3. Prepare the grounded case brief. This works without model credentials through the deterministic fallback.

```bash
curl -X POST http://127.0.0.1:8787/cases/$CASE_ID/case-brief
```

4. Refresh the reviewer console.
5. Inspect normalized facts, readiness, rule results, unknowns, traceability, and Decision Timeline.
6. Optional live model beat: paste an OpenAI API key and the smallest model ID you can use into **Grounded Case Brief**, then click **Generate Brief**. The badge should flip from `FALLBACK (no key)` to `LIVE MODEL`.
7. Submit `REQUEST_EVIDENCE` with reviewer identity, reason, and required evidence.
8. Open the Handoff view and inspect Markdown plus JSON. Point out:
   - `handoff_id`
   - `generated_from_case_version`
   - `generated_from_decision_event`
9. Open Pack Back and import the seeded return update.
10. Inspect Versions, Decision Story, and Timeline through the API:

```bash
curl http://127.0.0.1:8787/cases/$CASE_ID/versions
curl http://127.0.0.1:8787/cases/$CASE_ID/decision-story
```

11. State the thesis: deterministic systems verify facts, AI prepares a grounded case, and humans own decisions through explicit events.

## Guardrail Proof Beat

For the strongest judging clip, show the system refusing unsafe shortcuts:

- generic API writes cannot mutate `human_decision`
- bank mismatch cannot be approved while readiness is false
- fake model citations are rejected before storage

The model can be small and untrusted because the grounding, citation check, and human-only decision boundary are architectural.

## Optional Clean Approval Path

For a direct approval demo:

```bash
CLEAN_CASE_ID=$(node scripts/seed-demo-case.js SCN-CLEAN | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>console.log(JSON.parse(s).case_id))")
curl -X POST http://127.0.0.1:8787/cases/$CLEAN_CASE_ID/deterministic-review
curl -X POST http://127.0.0.1:8787/cases/$CLEAN_CASE_ID/case-brief
```

Then approve in the reviewer console and inspect the generated Decision Handoff.
