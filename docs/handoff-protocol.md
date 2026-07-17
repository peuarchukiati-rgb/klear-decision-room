# Handoff Protocol

## Definition

A handoff is a state-transfer protocol.

It is not a summary, recap, or status update. A valid handoff carries enough intent, evidence, current state, next action, and return path for another human or agent to continue the work without re-deriving context or inventing missing facts.

Short form:

```text
state + intent + evidence + next action + return path
```

## Core Rule

The format is flexible. The discipline is not.

Every handoff must preserve:

- what is known
- what is unknown
- what changed
- who owns the next action
- what evidence supports the claims
- what must come back to close the loop

If a fact is not in the source state, do not invent it. Mark it as unknown or ask for it.

## Two-Plane Artifact

Every serious handoff should have two planes generated from the same source state.

### Human-Readable Plane

For the next person or agent operator.

Include:

- handoff title
- source system or sender
- current status
- why this handoff exists
- key facts
- relevant evidence
- current decision or recommendation
- unresolved items
- required next action
- next owner
- how to pack back

### Machine-Readable Plane

For systems, tools, agents, tests, or future imports.

Include stable structured fields such as:

```json
{
  "handoff_id": "HANDOFF-...",
  "handoff_type": "DECISION_HANDOFF",
  "source_object_id": "CASE-ID",
  "source_version": 7,
  "source_event_id": "HDEC-0003",
  "status": "EVIDENCE_REQUIRED",
  "current_owner": {},
  "next_owner": {},
  "facts": [],
  "evidence": [],
  "unknowns": [],
  "required_actions": [],
  "pack_back_expected": true
}
```

The prose layer must never introduce a fact absent from the machine-readable layer or source state.

## Required Sections

Use this minimum structure for Markdown handoffs:

```md
# Handoff — <short name>

Handoff ID: <stable id>
Source: <system/person>
Source object: <case/task/project id>
Source version: <version>
Source event: <decision/update/event id or None>
Generated at: <timestamp>
Current owner: <who owns it now>
Next owner: <who acts next>

## Why This Exists
<one short paragraph>

## Current State
- <known fact>
- <known fact>

## Evidence
- <evidence id/source/reference>

## Unknowns
- <unknown or "None recorded">

## Required Next Action
- <specific action>

## Pack Back
Return an update using the Pack Back block below.

## Machine-Readable Plane
```json
{}
```
```

## Pack Back Protocol

Pack Back is how work returns.

A handoff is incomplete unless the receiver knows how to send back progress, new facts, blockers, or completion.

Supported Pack Back event types:

- `EVIDENCE_PROVIDED`
- `ACTION_COMPLETED`
- `DECISION_RESPONSE`
- `ESCALATION_RESPONSE`
- `CORRECTION_REQUESTED`
- `UNABLE_TO_COMPLETE`

Minimum Pack Back shape:

```json
{
  "case_id": "CASE-ID",
  "source_case_version": 7,
  "handoff_id": "HANDOFF-...",
  "responding_actor": {
    "role": "NEXT_OWNER",
    "name": "Vendor Desk"
  },
  "event_type": "EVIDENCE_PROVIDED",
  "completed_actions": [],
  "new_evidence": [],
  "changed_fields": [],
  "unresolved_items": [],
  "note": "",
  "timestamp": "2026-07-17T00:00:00.000Z"
}
```

Pack Back must be merged as a new version. Never silently overwrite prior state.

## Merge Rules

When importing or merging a returned handoff:

1. Validate the target object ID.
2. Validate the source version.
3. Reject unknown fields.
4. Preserve prior versions.
5. Add new information as a new event.
6. Recompute derived projections from source state.
7. Do not let ordinary Pack Back mutate protected human decisions.
8. If the source version is stale, return a version conflict instead of overwriting.

## Decision Room Specialization

In KLEAR Decision Room:

- `DecisionCase` is the canonical object.
- Readiness, traceability, timeline, Decision Story, and handoff are derived projections.
- `human_decision_events` is the canonical human decision log.
- `human_decision` is only the latest-event snapshot.
- terminal states require explicit human decision events.
- deterministic review and AI case writing may prepare or verify, but may not own the decision.

Decision handoff lineage must include:

- `handoff_id`
- `generated_from_case_version`
- `generated_from_decision_event`
- referenced evidence IDs
- referenced rule IDs
- generation timestamp

## Agent Instructions

When an agent receives a handoff:

1. Read the machine-readable plane first.
2. Read the human-readable plane for intent and nuance.
3. Identify the required next action.
4. Do only work supported by the handoff or attached evidence.
5. Preserve unknowns explicitly.
6. Produce Pack Back when done, blocked, corrected, or unable to complete.
7. Never replace the original state. Return a delta.

When an agent creates a handoff:

1. Use the latest persisted state.
2. Include source version and source event.
3. Cite evidence or record why evidence is unavailable.
4. Name the next owner.
5. Name the required next action.
6. Include a Pack Back template.
7. Embed a machine-readable plane.

## Anti-Patterns

These are not valid handoffs:

- a loose summary with no source version
- prose with no machine-readable state
- recommendations with no evidence
- missing next owner
- missing return path
- hidden assumptions
- stale state overwritten without conflict handling
- AI-generated facts not present in source material

## One-Line Test

A handoff is valid if a fresh human or agent can answer:

```text
What is the current state, why does it matter, what evidence supports it,
what exactly should I do next, and what must I send back?
```

If not, it is not a handoff yet.
