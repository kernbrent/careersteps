import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type PreviewApi = {
  render: (invoice: Record<string, unknown>, assets: Record<string, unknown>) => string;
};

function loadPreview(): PreviewApi {
  const source = readFileSync(resolve(process.cwd(), "../admin/assets/invoice-preview.js"), "utf8");
  const sandbox: Record<string, unknown> = {
    Date,
    Intl,
    CareerStepsInvoiceDocx: {
      longDate: (value: string) => value,
      compactDateRange: (start: string, end: string) => `${start}-${end}`,
    },
  };
  runInNewContext(source, sandbox);
  const api = sandbox.CareerStepsInvoicePreview as PreviewApi | undefined;
  if (!api) throw new Error("The invoice preview renderer was not loaded.");
  return api;
}

describe("invoice preview", () => {
  it("renders the unsaved invoice in the same section order as the Word document", () => {
    const html = loadPreview().render({
      client_name: "Metro Relief",
      invoice_number: "CS-2026-003",
      created_date: "2026-09-04",
      period_start: "2026-09-01",
      period_end: "2026-09-04",
      due_date: "2026-09-04",
      contract_name: "Consulting Services",
      summary: "Current unsaved summary",
      payment_terms: "Due on Receipt",
      payment_instructions: "Paper check",
      currency_code: "USD",
      total_amount: 600,
      items: [{
        billing_type: "fixed",
        cadence: "weekly",
        work_type: "Consulting Services",
        description: "Weekly contract rate",
        quantity: 1,
        unit_rate: 600,
        line_total: 600,
      }],
    }, {
      businessLogoUrl: "business-logo.png",
      clientLogoUrl: "client-logo.png",
      signatureUrl: "signature.png",
    });

    expect(html).toContain("Current unsaved summary");
    expect(html).toContain("$600.00/week");
    expect(html).toContain("Total due");
    expect(html.indexOf("1. Summary")).toBeLessThan(html.indexOf("2. Invoice"));
    expect(html.indexOf("Invoice details")).toBeLessThan(html.indexOf("3. Signatures"));
  });

  it("shows a safe placeholder for a first-use logo URL", () => {
    const html = loadPreview().render({
      client_name: "New Client",
      invoice_number: "CS-2026-004",
      created_date: "2026-09-04",
      period_start: "2026-09-04",
      period_end: "2026-09-04",
      contract_name: "Project",
      total_amount: 100,
      items: [{ billing_type: "fixed", cadence: "one_time", work_type: "Project", quantity: 1, unit_rate: 100 }],
    }, { clientLogoPending: true });

    expect(html).toContain("Client logo");
    expect(html).toContain("URL supplied");
    expect(html).not.toContain("https://");
  });
});
