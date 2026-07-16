export function deriveTraceabilityMap(decisionCase) {
  const evidenceById = new Map(decisionCase.evidence.map((item) => [item.evidence_id, item]));
  const evidenceToRules = new Map(decisionCase.evidence.map((item) => [item.evidence_id, []]));

  const rules = decisionCase.rule_results.map((rule) => {
    const linkedEvidence = (rule.evidence_ids || []).map((evidenceId) => {
      if (!evidenceToRules.has(evidenceId)) {
        evidenceToRules.set(evidenceId, []);
      }
      evidenceToRules.get(evidenceId).push(rule.rule_id);
      return {
        evidence_id: evidenceId,
        found: evidenceById.has(evidenceId),
        source: evidenceById.get(evidenceId) || null
      };
    });

    return {
      rule_id: rule.rule_id,
      rule_name: rule.rule_name,
      status: rule.status,
      severity: rule.severity,
      summary: rule.summary,
      recommended_gate: rule.recommended_gate,
      evidence: linkedEvidence,
      missing_evidence_reason: rule.details?.evidence_unavailable_reason || null
    };
  });

  const evidence = decisionCase.evidence.map((item) => ({
    evidence_id: item.evidence_id,
    source_type: item.source_type,
    source_name: item.source_name,
    source_location: item.source_location,
    field: item.field,
    value: item.value,
    referenced_by_rule_ids: evidenceToRules.get(item.evidence_id) || []
  }));

  return {
    case_id: decisionCase.case_id,
    version: decisionCase.version,
    rules,
    evidence
  };
}
