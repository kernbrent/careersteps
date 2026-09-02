import { describe, expect, it } from "vitest";
import { normalizeRecordPayload, normalizeTripBatchPayload, recordTable } from "../src/index";

describe("bookkeeping record validation", () => {
  it("allows only known database tables", () => {
    expect(recordTable("expenses")).toBe("expenses");
    expect(recordTable("income_payments")).toBe("income_payments");
    expect(recordTable("trip_templates")).toBe("trip_templates");
    expect(recordTable("mileage_rates")).toBe("mileage_rates");
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

  it("allows clients without projects but requires a client reference for projects", () => {
    const client = normalizeRecordPayload("clients", {
      name: "Standalone Client",
      is_active: true,
    });
    expect(client.name).toBe("Standalone Client");
    expect(client.project_id).toBeUndefined();

    expect(() => normalizeRecordPayload("projects", {
      client_id: null,
      name: "Orphan Project",
      is_active: true,
    })).toThrow(/client_id is invalid/i);
  });

  it("rejects invalid dates, amounts, statuses, and colors", () => {
    expect(() => normalizeRecordPayload("mileage_entries", { mileage_date: "2026-02-30" })).toThrow(/valid date/i);
    expect(() => normalizeRecordPayload("income", { amount: -1 })).toThrow(/allowed range/i);
    expect(() => normalizeRecordPayload("expenses", { record_status: "approved" })).toThrow(/invalid/i);
    expect(() => normalizeRecordPayload("categories", { color: "red" })).toThrow(/valid category color/i);
  });

  it("normalizes effective-dated mileage rates", () => {
    const payload = normalizeRecordPayload("mileage_rates", {
      effective_from: "2026-07-01",
      effective_to: "2026-12-31",
      rate_per_mile: 0.76,
      label: "IRS business rate - Jul through Dec 2026",
      is_active: true,
      owner_id: "attacker",
    });
    expect(payload).toEqual({
      effective_from: "2026-07-01",
      effective_to: "2026-12-31",
      rate_per_mile: 0.76,
      label: "IRS business rate - Jul through Dec 2026",
      is_active: 1,
    });
    expect(() => normalizeRecordPayload("mileage_rates", {
      effective_from: "2026-07-01",
      effective_to: "2026-06-30",
    })).toThrow(/ending date/i);
    expect(() => normalizeRecordPayload("mileage_rates", {
      rate_per_mile: 101,
    })).toThrow(/allowed range/i);
  });

  it("normalizes multi-date mileage and toll batches", () => {
    const payload = normalizeTripBatchPayload({
      dates: ["2026-09-03", "2026-09-01", "2026-09-03"],
      origin: "  McKinney, TX ",
      destination: "Dallas, TX",
      business_purpose: "Client meeting",
      miles: 64.2,
      client_id: null,
      project_id: null,
      record_status: "included",
      cpa_review: false,
      toll_amount: 8.75,
      toll_vendor: "NTTA",
      allow_duplicates: false,
    });
    expect(payload.dates).toEqual(["2026-09-01", "2026-09-03"]);
    expect(payload.origin).toBe("McKinney, TX");
    expect(payload.tollAmount).toBe(8.75);
  });

  it("rejects invalid trip batches", () => {
    expect(() => normalizeTripBatchPayload({ dates: [] })).toThrow(/trip dates/i);
    expect(() => normalizeTripBatchPayload({
      dates: ["2026-02-30"],
      origin: "A",
      destination: "B",
      business_purpose: "Meeting",
      miles: 10,
      record_status: "included",
      cpa_review: false,
      toll_amount: 0,
    })).toThrow(/valid date/i);
  });
});
