import { readFile } from "node:fs/promises";
import { CaseStore } from "../packages/case-store/src/caseStore.js";
import { OwnerRole, createOwner } from "../packages/case-schema/src/index.js";

const invoices = JSON.parse(await readFile("data/demo/demo-invoices.json", "utf8"));
const scenarioId = process.argv[2] || "SCN-CLEAN";
const selected = invoices.find((item) => item.scenario_id === scenarioId);

if (!selected) {
  throw new Error(`Unknown scenario: ${scenarioId}`);
}

const store = new CaseStore();
const decisionCase = await store.createCase({
  requester: createOwner(OwnerRole.REQUESTER, "Demo Requester"),
  current_owner: createOwner(OwnerRole.REVIEWER, "Finance Reviewer"),
  next_owner: createOwner(OwnerRole.REVIEWER, "Finance Reviewer"),
  input_records: [
    {
      input_id: `INPUT-${selected.scenario_id}`,
      source_type: "INVOICE",
      source_name: selected.source_name,
      received_at: new Date().toISOString(),
      payload: selected.invoice
    }
  ]
});

console.log(JSON.stringify(decisionCase, null, 2));
