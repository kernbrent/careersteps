import { describe, expect, it } from "vitest";
import { normalizeRecordPayload, recordTable } from "../src/index";

describe("bookkeeping record validation", () => {
  it("allows only known database tables", () => {
    expect(recordTable("expenses")).toBe("expenses");
    expect(recordTable("income_payments")).toBe("income_payments");
    expect(recordTable("admin_sessions")).toBeNull();
    expect(recordTable("expenses; DROP TABLE expenses")).toBeNull();
  });

  it("normalizes an expense without accepting extra fields", () => {
    const payload = normalizeRecordPayload("expenses", {
      expense_date: "2026-09-01",
      vendor: "  Office Depot  ",
      amount: 42.5,
      category_id: null,
      client_id: null,
      project_id: null,
      tax_year: 2026,
      reimbursable: false,
      reimbursed: false,
      deductibility_percent: 100,
      record_status: "included",
      cpa_review: false,
      owner_id: "attacker",
      created_at: "forged",
    });
    expect(payload.vendor).toBe("Office Depot");
    expect(payload.reimbursable).toBe(0);
    expect(payload.owner_id).toBeUndefined();
    expect(payload.created_at).toBeUndefined();
  });

  it("rejects invalid dates, amounts, statuses, and colors", () => {
    expect(() => normalizeRecordPayload("mileage_entries", { mileage_date: "2026-02-30" })).toThrow(/valid date/i);
    expect(() => normalizeRecordPayload("income", { amount: -1 })).toThrow(/allowed range/i);
    expect(() => normalizeRecordPayload("expenses", { record_status: "approved" })).toThrow(/invalid/i);
    expect(() => normalizeRecordPayload("categories", { color: "red" })).toThrow(/valid category color/i);
  });
});
