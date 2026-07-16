export const CASE_BRIEF_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: [
    "factual_summary",
    "decision_context",
    "risk_explanation",
    "recommended_disposition",
    "recommendation_reason",
    "missing_information_request",
    "next_owner_handoff",
    "citations",
    "model_warnings"
  ],
  properties: {
    factual_summary: { type: "string" },
    decision_context: { type: "string" },
    risk_explanation: { type: "string" },
    recommended_disposition: {
      type: "string",
      enum: ["APPROVE", "REJECT", "HOLD", "REQUEST_EVIDENCE", "ESCALATE"]
    },
    recommendation_reason: { type: "string" },
    missing_information_request: { type: "string" },
    next_owner_handoff: { type: "string" },
    citations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "evidence_ids", "rule_ids"],
        properties: {
          claim: { type: "string" },
          evidence_ids: {
            type: "array",
            items: { type: "string" }
          },
          rule_ids: {
            type: "array",
            items: { type: "string" }
          }
        }
      }
    },
    model_warnings: {
      type: "array",
      items: { type: "string" }
    }
  }
});

export const RESPONSE_FORMAT = Object.freeze({
  type: "json_schema",
  name: "klear_decision_case_brief",
  strict: true,
  schema: CASE_BRIEF_SCHEMA
});
