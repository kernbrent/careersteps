-- Check inside the deletion transaction so a concurrent payment cannot be lost.
CREATE TRIGGER invoice_delete_payment_guard BEFORE DELETE ON invoices
WHEN OLD.status NOT IN ('pending', 'overdue', 'void') OR EXISTS (
  SELECT 1 FROM income_payments WHERE income_id = OLD.income_id
)
BEGIN
  SELECT RAISE(ABORT, 'Invoices with payments must be retained');
END;
