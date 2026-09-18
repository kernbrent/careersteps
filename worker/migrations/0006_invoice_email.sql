ALTER TABLE invoices ADD COLUMN emailed_at TEXT;
ALTER TABLE invoices ADD COLUMN emailed_to TEXT;
ALTER TABLE invoices ADD COLUMN email_message_id TEXT;
ALTER TABLE invoices ADD COLUMN email_error TEXT;

-- One durable send operation per invoice. A confirmed resend replaces a completed
-- operation; uncertain operations keep their immutable payload and provider key.
CREATE TABLE invoice_email_operations (
  invoice_id TEXT PRIMARY KEY REFERENCES invoices(id) ON DELETE RESTRICT,
  id TEXT NOT NULL UNIQUE,
  recipient TEXT NOT NULL,
  payload_path TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent')),
  message_id TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  lease_until TEXT NOT NULL
);

CREATE TRIGGER invoice_email_freeze_content BEFORE UPDATE OF
 client_id, project_id, invoice_number, created_date, period_start, period_end,
 due_date, contract_name, purchase_order, summary, payment_terms,
 payment_instructions, include_client_logo, client_logo_artifact_id, total_amount
ON invoices WHEN EXISTS (
 SELECT 1 FROM invoice_email_operations WHERE invoice_id=OLD.id AND status='pending'
)
BEGIN SELECT RAISE(ABORT, 'Resolve the unconfirmed invoice email before editing'); END;
