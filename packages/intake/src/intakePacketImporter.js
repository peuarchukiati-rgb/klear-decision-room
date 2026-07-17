import { readFile } from "node:fs/promises";
import { EvidenceSourceType, OwnerRole, createOwner } from "../../case-schema/src/index.js";

export const IntakePacketType = Object.freeze({
  STRUCTURED_HANDOFF: "STRUCTURED_HANDOFF",
  MESSY_INTAKE: "MESSY_INTAKE"
});

const PROTECTED_FIELDS = new Set(["human_decision", "human_decision_events"]);
const DEMO_INVOICE_PATH = "data/demo/demo-invoices.json";

function assertNoProtectedFields(value, path = "$") {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoProtectedFields(item, `${path}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (PROTECTED_FIELDS.has(key)) {
      throw new Error(`${key} cannot be supplied through intake packets`);
    }
    assertNoProtectedFields(child, `${path}.${key}`);
  }
}

function extractJsonFromMarkdown(text) {
  const match = String(text || "").match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (!match) return null;
  return JSON.parse(match[1]);
}

function coercePacket(body = {}) {
  if (body.packet && typeof body.packet === "object") return body.packet;
  if (body.content && typeof body.content === "string") {
    const parsed = extractJsonFromMarkdown(body.content);
    if (parsed) return parsed;
    return {
      packet_type: body.packet_type || IntakePacketType.MESSY_INTAKE,
      packet_id: body.packet_id,
      title: body.title,
      raw_text: body.content
    };
  }
  return body;
}

function requiredString(value, field) {
  if (!value || typeof value !== "string") {
    throw new Error(`${field} is required`);
  }
  return value;
}

function parseMoney(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function parseMessyInvoice(rawText = "") {
  const text = String(rawText);
  return {
    invoice_number: firstMatch(text, [
      /invoice(?:\s*(?:number|no\.?|#))?\s*[:#-]\s*([A-Z0-9-]+)/i,
      /\b(INV-[A-Z0-9-]+|NE-[A-Z0-9-]+|BL-[A-Z0-9-]+|UN-[A-Z0-9-]+)\b/i
    ]),
    vendor_name: firstMatch(text, [/vendor\s*(?:name)?\s*[:#-]\s*([^\n,;]+)/i]),
    vendor_id: firstMatch(text, [/\b(VEN-[A-Z0-9-]+)\b/i, /vendor\s*id\s*[:#-]\s*([A-Z0-9-]+)/i]),
    invoice_date: firstMatch(text, [/invoice\s*date\s*[:#-]\s*(\d{4}-\d{2}-\d{2})/i]),
    due_date: firstMatch(text, [/due\s*date\s*[:#-]\s*(\d{4}-\d{2}-\d{2})/i]),
    currency: firstMatch(text, [/\b(USD|EUR|GBP|THB)\b/i]) || "USD",
    subtotal: parseMoney(firstMatch(text, [/subtotal\s*[:#-]\s*([$0-9.,-]+)/i])),
    tax: parseMoney(firstMatch(text, [/tax\s*[:#-]\s*([$0-9.,-]+)/i])),
    total: parseMoney(firstMatch(text, [/total\s*[:#-]\s*([$0-9.,-]+)/i, /amount\s*[:#-]\s*([$0-9.,-]+)/i])),
    bank_name: firstMatch(text, [/bank\s*(?:name)?\s*[:#-]\s*([^\n,;]+)/i]),
    bank_account: firstMatch(text, [/bank\s*account\s*[:#-]\s*([0-9-]+)/i, /acct\s*[:#-]\s*([0-9-]+)/i]),
    purchase_order: firstMatch(text, [/\b(PO-[A-Z0-9-]+)\b/i, /purchase\s*order\s*[:#-]\s*([A-Z0-9-]+)/i])
  };
}

function supportingRecords(documents = [], packetId, receivedAt) {
  return documents.map((document, index) => ({
    input_id: `INPUT-${packetId}-SUPPORT-${index + 1}`,
    source_type: EvidenceSourceType.SUPPORTING_DOCUMENT,
    source_name: document.source_name || `supporting-document-${index + 1}`,
    received_at: receivedAt,
    payload: document
  }));
}

function toDecisionCaseInput(packet) {
  const packetType = packet.packet_type || packet.type;
  const packetId = requiredString(packet.packet_id || packet.id, "packet_id").toUpperCase().replace(/[^A-Z0-9-]+/g, "-");
  const receivedAt = packet.received_at || new Date().toISOString();
  const requester = packet.requester?.name || packet.requester_name || "Intake Requester";
  const reviewer = packet.current_owner?.name || packet.reviewer_name || "Finance Reviewer";

  if (packetType === IntakePacketType.STRUCTURED_HANDOFF) {
    const invoice = packet.invoice || packet.case_context?.invoice;
    if (!invoice || typeof invoice !== "object") {
      throw new Error("structured handoff packet requires invoice");
    }
    return {
      requester: createOwner(OwnerRole.REQUESTER, requester),
      current_owner: createOwner(OwnerRole.REVIEWER, reviewer),
      next_owner: createOwner(OwnerRole.REVIEWER, reviewer),
      input_records: [
        {
          input_id: `INPUT-${packetId}-INVOICE`,
          source_type: EvidenceSourceType.INVOICE,
          source_name: packet.invoice_source_name || packet.source_name || `${packetId.toLowerCase()}-invoice.pdf`,
          received_at: receivedAt,
          payload: invoice
        },
        ...supportingRecords(packet.supporting_documents || packet.evidence || [], packetId, receivedAt),
        {
          input_id: `INPUT-${packetId}-HANDOFF`,
          source_type: EvidenceSourceType.USER_NOTE,
          source_name: "structured-handoff-packet",
          received_at: receivedAt,
          payload: {
            packet_id: packetId,
            packet_type: packetType,
            title: packet.title || "Structured handoff packet",
            requested_decision: packet.requested_decision || "",
            return_path: packet.return_path || null
          }
        }
      ]
    };
  }

  if (packetType === IntakePacketType.MESSY_INTAKE) {
    const rawText = requiredString(packet.raw_text || packet.text || packet.content, "raw_text");
    return {
      requester: createOwner(OwnerRole.REQUESTER, requester),
      current_owner: createOwner(OwnerRole.REVIEWER, reviewer),
      next_owner: createOwner(OwnerRole.REQUESTER, requester),
      input_records: [
        {
          input_id: `INPUT-${packetId}-INVOICE`,
          source_type: EvidenceSourceType.INVOICE,
          source_name: packet.source_name || "messy-intake-note.txt",
          received_at: receivedAt,
          payload: parseMessyInvoice(rawText)
        },
        {
          input_id: `INPUT-${packetId}-RAW`,
          source_type: EvidenceSourceType.USER_NOTE,
          source_name: packet.source_name || "messy-intake-note.txt",
          received_at: receivedAt,
          payload: {
            packet_id: packetId,
            packet_type: packetType,
            title: packet.title || "Messy intake note",
            raw_text: rawText
          }
        }
      ]
    };
  }

  throw new Error(`Unsupported intake packet type: ${packetType}`);
}

export async function importIntakePacket(caseStore, body = {}) {
  const packet = coercePacket(body);
  assertNoProtectedFields(packet);
  const decisionCase = await caseStore.createCase(toDecisionCaseInput(packet));
  return {
    packet: {
      packet_id: packet.packet_id || packet.id,
      packet_type: packet.packet_type || packet.type,
      title: packet.title || ""
    },
    case: decisionCase
  };
}

function structuredDemoPacket(scenario, index) {
  return {
    packet_id: `DEMO-HANDOFF-${scenario.scenario_id}`,
    packet_type: IntakePacketType.STRUCTURED_HANDOFF,
    title: `${scenario.scenario_id} structured handoff`,
    requester: { role: OwnerRole.REQUESTER, name: "Demo Requester" },
    current_owner: { role: OwnerRole.REVIEWER, name: "Finance Reviewer" },
    requested_decision: "Review whether this invoice is ready for payment approval.",
    return_path: {
      owner: "Accounts Payable",
      expected_event: "ACTION_COMPLETED"
    },
    invoice_source_name: scenario.source_name || `demo-invoice-${index + 1}.pdf`,
    invoice: scenario.invoice,
    supporting_documents: scenario.supporting_documents || []
  };
}

function messyDemoPacket(scenario, index) {
  const invoice = scenario.invoice;
  return {
    packet_id: `DEMO-MESSY-${scenario.scenario_id}`,
    packet_type: IntakePacketType.MESSY_INTAKE,
    title: `${scenario.scenario_id} messy intake`,
    requester_name: "Demo Requester",
    reviewer_name: "Finance Reviewer",
    source_name: `messy-${scenario.scenario_id.toLowerCase()}-${index + 1}.txt`,
    raw_text: [
      `Please check invoice ${invoice.invoice_number || "(number not clear)"} for ${invoice.vendor_name || "unknown vendor"}.`,
      invoice.vendor_id ? `Vendor ID: ${invoice.vendor_id}` : "Vendor ID is not available in the note.",
      invoice.invoice_date ? `Invoice date: ${invoice.invoice_date}` : "",
      invoice.due_date ? `Due date: ${invoice.due_date}` : "",
      `Amount total: ${invoice.currency || "USD"} ${invoice.total ?? "unclear"}`,
      invoice.subtotal !== null && invoice.subtotal !== undefined ? `Subtotal: ${invoice.subtotal}` : "",
      invoice.tax !== null && invoice.tax !== undefined ? `Tax: ${invoice.tax}` : "Tax not stated.",
      invoice.bank_account ? `Bank account: ${invoice.bank_account}` : "Bank account missing from requester note.",
      invoice.bank_name ? `Bank name: ${invoice.bank_name}` : "",
      invoice.purchase_order ? `PO: ${invoice.purchase_order}` : "PO/support not attached."
    ].filter(Boolean).join("\n")
  };
}

export async function listDemoIntakePackets({ demoInvoicePath = DEMO_INVOICE_PATH } = {}) {
  const scenarios = JSON.parse(await readFile(demoInvoicePath, "utf8"));
  return scenarios.flatMap((scenario, index) => [
    {
      packet_id: `DEMO-HANDOFF-${scenario.scenario_id}`,
      label: `${scenario.scenario_id}: structured handoff`,
      kind: "structured",
      scenario_id: scenario.scenario_id,
      packet: structuredDemoPacket(scenario, index)
    },
    {
      packet_id: `DEMO-MESSY-${scenario.scenario_id}`,
      label: `${scenario.scenario_id}: messy intake`,
      kind: "messy",
      scenario_id: scenario.scenario_id,
      packet: messyDemoPacket(scenario, index)
    }
  ]);
}
