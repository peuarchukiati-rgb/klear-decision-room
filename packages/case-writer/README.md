# Case Writer

Grounded case-writing layer for KLEAR Decision Room.

Inputs:

- stored facts
- deterministic rule results
- unknowns
- evidence metadata
- policy metadata
- allowed recommendation values

Outputs are validated before storage:

- citation evidence IDs must exist on the case
- citation rule IDs must exist on the case
- hard-gated cases cannot receive an approval recommendation
- output must match the structured case-brief shape

Model IDs must come from environment or config and must not be hardcoded in source.
