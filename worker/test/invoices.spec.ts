import { describe, expect, it } from "vitest";
import { normalizeInvoicePayload } from "../src/index";

const baseInvoice = () => ({
  client_id: "client_12345678",
  project_id: null,
  profile_id: null,
  invoice_number: "CS-2026-006",
  created_date: "2026-09-04",
  period_start: "2026-08-31",
  period_end: "2026-09-04",
  due_date: "2026-10-04",
  contract_name: "Metro Relief Statement of Work",
  purchase_order: null,
  summary: "Consulting services for the second week of the engagement.",
  payment_terms: "Net 30",
  payment_instructions: null,
  include_client_logo: false,
  client_logo_artifact_id: null,
  summary_source_artifact_id: null,
  local_folder_name: "Metro Relief Billing",
  notes: null,
  save_profile_name: "Metro Relief weekly",
  items: [
    {
      billing_type: "fixed",
      cadence: "weekly",
      work_type: "Weekly Consulting Services",
      description: "Flat weekly services",
      quantity: 1,
      unit_rate: 600,
    },
    {
      billing_type: "hourly",
      cadence: "monthly",
      work_type: "Additional implementation",
      description: "Three and one-half hours",
      quantity: 3.5,
      unit_rate: 125,
    },
  ],
});

describe("invoice validation", () => {
  it("normalizes mixed fixed and hourly lines and calculates the total", () => {
    const invoice = normalizeInvoicePayload(baseInvoice());
    expect(invoice.items[0]).toMatchObject({
      billing_type: "fixed",
      cadence: "weekly",
      line_total: 600,
    });
    expect(invoice.items[1]).toMatchObject({
      billing_type: "hourly",
      cadence: null,
      line_total: 437.5,
    });
    expect(invoice.total_amount).toBe(1037.5);
    expect(invoice.include_client_logo).toBe(0);
  });

  it("rejects a reversed billing period and an invalid due date", () => {
    expect(() => normalizeInvoicePayload({
      ...baseInvoice(),
      period_start: "2026-09-05",
      period_end: "2026-09-04",
    })).toThrow(/end date/i);
    expect(() => normalizeInvoicePayload({
      ...baseInvoice(),
      due_date: "2026-09-03",
    })).toThrow(/due date/i);
  });

  it("requires a saved or newly uploaded logo when the logo option is selected", () => {
    expect(() => normalizeInvoicePayload({
      ...baseInvoice(),
      include_client_logo: true,
      client_logo_artifact_id: null,
    })).toThrow(/logo/i);
  });

  it("rejects empty or non-positive invoices", () => {
    expect(() => normalizeInvoicePayload({ ...baseInvoice(), items: [] })).toThrow(/billing lines/i);
    expect(() => normalizeInvoicePayload({
      ...baseInvoice(),
      items: [{
        billing_type: "fixed",
        cadence: "weekly",
        work_type: "No-charge placeholder",
        description: null,
        quantity: 1,
        unit_rate: 0,
      }],
    })).toThrow(/greater than zero/i);
  });
});
