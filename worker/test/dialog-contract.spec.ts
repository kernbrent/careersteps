import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const adminScript = readFileSync(resolve(process.cwd(), "../admin/assets/app.js"), "utf8");
const invoiceScript = readFileSync(resolve(process.cwd(), "../admin/assets/invoice-ui.js"), "utf8");
const adminPage = readFileSync(resolve(process.cwd(), "../admin/index.html"), "utf8");

describe("Admin dialog behavior", () => {
  it("does not dismiss open dialogs when their backdrop is clicked", () => {
    expect(adminScript).toContain("preventDialogBackdropDismissal");
    expect(adminScript).toContain("event.stopImmediatePropagation()");
    expect(adminPage).toContain('closedby="closerequest"');
    expect(adminScript).not.toContain('event.target === $("#record-dialog")');
  });

  it("offers a preview that does not submit the invoice form", () => {
    expect(invoiceScript).toContain('type="button" data-action="preview-invoice"');
    expect(invoiceScript).toContain("invoicePreviewDraft(form)");
    expect(invoiceScript).toContain("Nothing has been saved");
    expect(adminPage).toContain("invoice-preview.js");
  });
});
