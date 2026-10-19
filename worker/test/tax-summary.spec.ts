import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

function loadPortal() {
  const source = readFileSync(resolve(process.cwd(), "../admin/assets/app.js"), "utf8");
  const sheets: Record<string, any[]> = {};
  const pdfTables: any[] = [];
  const pdfText: string[] = [];
  const window: any = {
    XLSX: { utils: {
      book_new: () => ({}), json_to_sheet: (rows: any[]) => rows,
      book_append_sheet: (_book: any, rows: any[], name: string) => { sheets[name] = rows; },
    }, writeFile: () => {} },
    jspdf: { jsPDF: class {
      lastAutoTable = { finalY: 100 };
      setTextColor() {} setFont() {} setFontSize() {} addPage() {} save() {}
      text(text: string) { pdfText.push(text); }
      autoTable(table: any) { pdfTables.push(table); }
    } },
  };
  const instrumented = source.replace(/  init\(\)\.catch\([\s\S]*?\n  \}\);\s*\}\)\(\);\s*$/, `  window.testApi = { state, renderDashboard, renderReports, exportXlsx, exportPdf, exportRows, deductibleTolls, estimatedNetAfterMileage };\n})();`);
  expect(instrumented).not.toBe(source);
  runInNewContext(instrumented, { window, XLSX: window.XLSX, location: { hostname: "localhost", search: "" }, URLSearchParams,
    document: { querySelector: () => ({ append: () => {} }), createElement: () => ({ className: "", textContent: "", remove() {} }) }, setTimeout: () => {} });
  const api = window.testApi;
  Object.assign(api.state, {
    settings: { default_tax_year: 2026, currency_code: "USD", business_name: "Test" },
    categories: [{ id: "t", name: "Tolls" }, { id: "s", name: "Software" }],
    expenses: [
      { id: "t1", category_id: "t", amount: 79.2, deductibility_percent: 100, expense_date: "2026-10-19", tax_year: 2026, record_status: "included", vendor: "NTTA" },
      { id: "s1", category_id: "s", amount: 74.8, deductibility_percent: 100, expense_date: "2026-10-19", tax_year: 2026, record_status: "included", vendor: "Software" },
    ],
    income: [{ id: "i", income_date: "2026-10-19", tax_year: 2026, record_status: "included", amount: 5675, payer_name: "Client" }],
    income_payments: [{ income_id: "i", payment_date: "2026-10-19", amount: 5675 }],
    mileage_entries: [{ mileage_date: "2026-10-19", tax_year: 2026, record_status: "included", miles: 720, origin: "Office", destination: "Client" }],
    mileage_rates: [{ is_active: true, effective_from: "2026-01-01", effective_to: "2026-12-31", rate_per_mile: .75825 }],
  });
  return { api, window, sheets, pdfTables, pdfText };
}

describe("Tolls and mileage tax summaries", () => {
  it("shows tolls under expenses and subtracts mileage only once across dashboard, reports, workbook and PDF", () => {
    const { api, sheets, pdfTables } = loadPortal();
    for (const html of [api.renderDashboard(), api.renderReports()]) {
      expect(html).toContain("Includes $79.20 in tolls");
      expect(html).toContain("Business mileage");
      expect(html).not.toMatch(/Mileage &(?:amp;)? tolls/);
      expect(html).toContain("$5,521.00");
      expect(html).toContain("$4,975.06");
      expect(html).toContain("Net before mileage deduction");
    }
    api.exportXlsx();
    const metric = (name: string) => sheets.Summary!.find((row) => row.Metric === name)?.Value;
    expect(metric("Deductible expenses")).toBe(154);
    expect(metric("Tolls (already included in deductible expenses)")).toBe(79.2);
    expect(metric("Estimated net after mileage deduction")).toBeCloseTo(4975.06);
    expect(sheets["Expense Ledger"]).toHaveLength(2);
    api.exportPdf();
    expect(pdfTables[0].body[0]).toContain("$4,975.06");
    expect(pdfTables[0].body[0]).toContain("$154.00 (tolls: $79.20)");
  });

  it("uses deductible toll amounts, respects included status and never guesses net with missing mileage rates", () => {
    const { api, sheets, window, pdfText } = loadPortal();
    api.state.expenses[0].deductibility_percent = 50;
    api.state.expenses.push({ ...api.state.expenses[0], id: "excluded", amount: 999, record_status: "excluded" });
    api.state.mileage_rates = [];
    const html = api.renderDashboard();
    expect(html).toContain("Includes $39.60 in tolls");
    expect(html).toContain("Unavailable: mileage rate missing");
    api.renderReports();
    api.exportXlsx();
    expect(sheets.Summary!.find((row) => row.Metric === "Estimated net after mileage deduction").Value).toBe("Unavailable: mileage rate missing");
    delete window.jspdf.jsPDF.prototype.autoTable;
    api.exportPdf();
    expect(pdfText.join(" ")).toContain("Estimated net after mileage deduction: Unavailable: mileage rate missing");
    expect(pdfText.join(" ")).toContain("includes $39.60 in tolls");
  });

  it("handles empty ledgers without adding tolls to mileage", () => {
    const { api } = loadPortal();
    api.state.expenses = []; api.state.income_payments = []; api.state.mileage_entries = [];
    expect(api.renderDashboard()).toContain("Includes $0.00 in tolls");
    expect(api.estimatedNetAfterMileage(0, 0, { deduction: 0, missingRateCount: 0 })).toBe(0);
  });
});


