# Intake

Imports decision intake packets and normalizes structured invoice input into `DecisionCase` facts, unknowns, and invoice-field evidence.

Supported packet forms:

- structured handoff packets that already follow the handoff protocol
- messy intake notes that can be deterministically parsed into partial invoice input

Intake import cannot supply or mutate `human_decision` or `human_decision_events`.
