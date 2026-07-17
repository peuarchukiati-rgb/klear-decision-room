# Structured Handoff Packet: Bank Mismatch

This packet follows the KLEAR handoff protocol: state, intent, evidence, next action, and return path. It is structured enough for direct import, but the deterministic truth lane still decides whether the invoice is ready.

```json
{
  "packet_id": "DEMO-HANDOFF-SCN-BANK-MISMATCH",
  "packet_type": "STRUCTURED_HANDOFF",
  "title": "SCN-BANK-MISMATCH structured handoff",
  "requester": {
    "role": "REQUESTER",
    "name": "Demo Requester"
  },
  "current_owner": {
    "role": "REVIEWER",
    "name": "Finance Reviewer"
  },
  "requested_decision": "Review whether this invoice is ready for payment approval.",
  "return_path": {
    "owner": "Accounts Payable",
    "expected_event": "ACTION_COMPLETED"
  },
  "invoice_source_name": "nova-invoice-2291.pdf",
  "invoice": {
    "invoice_number": "NE-2291",
    "vendor_name": "Nova Equipment Services",
    "vendor_id": "VEN-NOVA-002",
    "invoice_date": "2026-07-10",
    "due_date": "2026-08-09",
    "currency": "USD",
    "subtotal": 3900,
    "tax": 312,
    "total": 4212,
    "bank_name": "Northstar Commercial",
    "bank_account": "8811111111",
    "purchase_order": "PO-70144"
  },
  "supporting_documents": [
    {
      "source_name": "nova-po-70144.pdf",
      "document_type": "PURCHASE_ORDER",
      "reference": "PO-70144"
    }
  ]
}
```
