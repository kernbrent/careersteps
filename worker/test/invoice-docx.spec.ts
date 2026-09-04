import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type InvoiceDocxApi = {
  buildInvoiceDocument: (invoice: Record<string, unknown>, assets: Record<string, unknown>) => Blob;
};

async function generatedArchiveText(): Promise<string> {
  const source = readFileSync(resolve(process.cwd(), "../admin/assets/invoice-docx.js"), "utf8");
  const sandbox: Record<string, unknown> = { Blob, DataView, Date, Intl, TextEncoder, Uint8Array };
  runInNewContext(source, sandbox);
  const api = sandbox.CareerStepsInvoiceDocx as InvoiceDocxApi | undefined;
  if (!api) throw new Error("The invoice document generator was not loaded.");
  const image = { bytes: new Uint8Array([137, 80, 78, 71]), mimeType: "image/png" };
  const blob = api.buildInvoiceDocument({
    client_name: "Metro Relief",
    invoice_number: "CS-2026-002",
    created_date: "2026-09-04",
    period_start: "2026-08-31",
    period_end: "2026-09-04",
    due_date: "2026-09-04",
    contract_name: "Metro Relief Consulting Services 2026",
    purchase_order: null,
    summary: "Invoice emailed to Jasmine and Austin",
    payment_terms: "Due on Receipt",
    payment_instructions: "Paper check to be cut",
    include_client_logo: false,
    currency_code: "USD",
    total_amount: 600,
    items: [{
      billing_type: "fixed",
      cadence: "weekly",
      work_type: "Consulting Services",
      description: "Fixed rate per contract of $600 per week",
      quantity: 1,
      unit_rate: 600,
      line_total: 600,
    }],
  }, { businessLogo: image, signature: image });
  return new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()));
}

describe("invoice Word document layout", () => {
  it("places the invoice details immediately before signatures", async () => {
    const archive = await generatedArchiveText();
    const summary = archive.indexOf("1. Summary");
    const invoice = archive.indexOf("2. Invoice");
    const details = archive.indexOf("Invoice details");
    const signatures = archive.indexOf("3. Signatures");

    expect(summary).toBeGreaterThan(-1);
    expect(invoice).toBeGreaterThan(summary);
    expect(details).toBeGreaterThan(invoice);
    expect(signatures).toBeGreaterThan(details);
  });

  it("uses a readable four-column table without mid-word hyphenation", async () => {
    const archive = await generatedArchiveText();

    expect(archive).toContain("<w:suppressAutoHyphens/>");
    expect(archive).toContain('<w:gridSpan w:val="3"/>');
    expect(archive).toContain('w:fill="0B2B78"');
    expect(archive).toContain('w:color w:val="FFFFFF"');
    expect(archive).toContain(">Services<");
    expect(archive).not.toContain('w:fill="FFF200"');
  });
});
