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
npm run reset-demo
npm start
```

Open:

```text
http://127.0.0.1:8787/
```

Primary path: use **Live Demo Mode** in the reviewer console.

1. Read the scenario aloud: Friday 4:15 PM, payment cutoff in 45 minutes, AP queue is messy, one invoice looks normal, but the bank account does not match vendor master.
2. Click **Run Bank-Mismatch Demo**.
3. Let the one-click proof run: intake import, deterministic review, grounded brief, blocked approval, human evidence request, and handoff acknowledgement with evidence still pending.
4. Scroll into the reviewer console and inspect normalized facts, readiness, rule results, evidence, handoff, and timeline.
5. Click **Compare Good vs Messy Intake** if you want to show why structured handoff quality matters and why messy input becomes explicit unknowns.

Manual scenario controls remain available for stepping through the same lifecycle one action at a time.

API fallback: in another shell, seed a case:

```bash
CASE_ID=$(node scripts/seed-demo-case.js SCN-BANK-MISMATCH | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>console.log(JSON.parse(s).case_id))")
echo $CASE_ID
```

## Walkthrough

1. Open the Decision Cases workspace and select the imported or seeded Living Decision Folder.
2. Run deterministic review if you are using the API path:

```bash
curl -X POST http://127.0.0.1:8787/cases/$CASE_ID/deterministic-review
```

3. The API fallback remains available for resilience testing:

```bash
curl -X POST http://127.0.0.1:8787/cases/$CASE_ID/case-brief
```

4. Refresh the reviewer console.
5. Inspect normalized facts, readiness, rule results, unknowns, traceability, and Decision Timeline.
6. For the judge-facing live beat, configure `KLEAR_MODEL_ID` on the server, paste only an OpenAI API key into the visible **Model Connection** field, and click **Connect & Run Live**. The red `OpenAI not connected` lane should change to `OpenAI live`.
7. Submit `REQUEST_EVIDENCE` with reviewer identity, reason, and required evidence.
8. Open the Handoff view and inspect Markdown plus JSON. Point out:
   - `handoff_id`
   - `generated_from_case_version`
   - `generated_from_decision_event`
9. Open Pack Back and import the seeded acknowledgement. Point out that the case remains evidence-required until vendor bank confirmation arrives.
10. Inspect Versions, Decision Story, and Timeline through the API:

```bash
curl http://127.0.0.1:8787/cases/$CASE_ID/versions
curl http://127.0.0.1:8787/cases/$CASE_ID/decision-story
```

11. State the thesis: deterministic systems verify facts, AI prepares a grounded case, humans own decisions through explicit events, and the payment stays blocked while evidence is unresolved.

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
