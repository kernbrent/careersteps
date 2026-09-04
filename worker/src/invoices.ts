import { AdminError, adminJson, readAdminJson } from "./security";

const OWNER_ID = "primary";
const MAX_ITEMS = 40;
const MAX_AMOUNT = 999_999_999.99;

type JsonRecord = Record<string, unknown>;

export type InvoiceItemInput = {
  billing_type: "fixed" | "hourly";
  cadence: "one_time" | "weekly" | "monthly" | null;
  work_type: string;
  description: string | null;
  quantity: number;
  unit_rate: number;
  line_total: number;
};

export type InvoiceInput = {
  client_id: string;
  project_id: string | null;
  profile_id: string | null;
  invoice_number: string;
  created_date: string;
  period_start: string;
  period_end: string;
  due_date: string | null;
  contract_name: string;
  purchase_order: string | null;
  summary: string | null;
  payment_terms: string | null;
  payment_instructions: string | null;
  include_client_logo: number;
  client_logo_artifact_id: string | null;
  summary_source_artifact_id: string | null;
  local_folder_name: string | null;
  notes: string | null;
  items: InvoiceItemInput[];
  total_amount: number;
  save_profile_name: string | null;
};

type ExistingInvoice = {
  id: string;
  income_id: string;
  status: string;
  paid_amount: number;
};

type ClientRow = { id: string; name: string };
type ProjectRow = { client_id: string };
type ArtifactRow = { id: string; client_id: string | null; artifact_type: string };

function has(body: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function text(body: JsonRecord, key: string, maximum: number, optional = false): string | null {
  const value = body[key];
  if (optional && (value === null || value === undefined || value === "")) return null;
  if (typeof value !== "string") throw new AdminError(422, "INVALID_INVOICE", `${key} must be text.`);
  const trimmed = value.trim();
  if (!trimmed && optional) return null;
  if (!trimmed || trimmed.length > maximum) {
    throw new AdminError(422, "INVALID_INVOICE", `${key} must contain between 1 and ${maximum} characters.`);
  }
  return trimmed;
}

function id(body: JsonRecord, key: string, optional = false): string | null {
  const value = body[key];
  if (optional && (value === null || value === undefined || value === "")) return null;
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{7,79}$/.test(value)) {
    throw new AdminError(422, "INVALID_INVOICE", `${key} is invalid.`);
  }
  return value;
}

function date(body: JsonRecord, key: string, optional = false): string | null {
  const value = body[key];
  if (optional && (value === null || value === undefined || value === "")) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AdminError(422, "INVALID_INVOICE", `${key} must be a valid date.`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month! - 1 || parsed.getUTCDate() !== day) {
    throw new AdminError(422, "INVALID_INVOICE", `${key} must be a valid date.`);
  }
  return value;
}

function amount(value: unknown, key: string, allowZero = false): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AdminError(422, "INVALID_INVOICE", `${key} must be a number.`);
  }
  const minimum = allowZero ? 0 : 0.01;
  if (value < minimum || value > MAX_AMOUNT) {
    throw new AdminError(422, "INVALID_INVOICE", `${key} is outside the allowed range.`);
  }
  return value;
}

function moneyRound(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeItem(value: unknown, index: number): InvoiceItemInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AdminError(422, "INVALID_INVOICE", `Billing line ${index + 1} is invalid.`);
  }
  const item = value as JsonRecord;
  const billingType = item.billing_type;
  if (billingType !== "fixed" && billingType !== "hourly") {
    throw new AdminError(422, "INVALID_INVOICE", `Choose a billing type for line ${index + 1}.`);
  }
  let cadence: InvoiceItemInput["cadence"] = null;
  if (billingType === "fixed") {
    if (!(["one_time", "weekly", "monthly"] as unknown[]).includes(item.cadence)) {
      throw new AdminError(422, "INVALID_INVOICE", `Choose a fixed-rate period for line ${index + 1}.`);
    }
    cadence = item.cadence as InvoiceItemInput["cadence"];
  }
  const quantity = amount(item.quantity, `quantity for line ${index + 1}`);
  const unitRate = amount(item.unit_rate, `rate for line ${index + 1}`, true);
  return {
    billing_type: billingType,
    cadence,
    work_type: text(item, "work_type", 240)!,
    description: text(item, "description", 2_000, true),
    quantity,
    unit_rate: moneyRound(unitRate),
    line_total: moneyRound(quantity * unitRate),
  };
}

export function normalizeInvoicePayload(body: JsonRecord): InvoiceInput {
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > MAX_ITEMS) {
    throw new AdminError(422, "INVALID_INVOICE", `Add between 1 and ${MAX_ITEMS} billing lines.`);
  }
  const items = body.items.map(normalizeItem);
  const totalAmount = moneyRound(items.reduce((sum, item) => sum + item.line_total, 0));
  if (totalAmount <= 0) throw new AdminError(422, "INVALID_INVOICE", "The invoice total must be greater than zero.");
  const createdDate = date(body, "created_date")!;
  const periodStart = date(body, "period_start")!;
  const periodEnd = date(body, "period_end")!;
  const dueDate = date(body, "due_date", true);
  if (periodEnd < periodStart) {
    throw new AdminError(422, "INVALID_INVOICE", "The invoice end date must be on or after the start date.");
  }
  if (dueDate && dueDate < createdDate) {
    throw new AdminError(422, "INVALID_INVOICE", "The due date must be on or after the invoice creation date.");
  }
  if (typeof body.include_client_logo !== "boolean") {
    throw new AdminError(422, "INVALID_INVOICE", "include_client_logo must be true or false.");
  }
  const includeClientLogo = body.include_client_logo ? 1 : 0;
  const clientLogoArtifactId = id(body, "client_logo_artifact_id", true);
  if (includeClientLogo && !clientLogoArtifactId) {
    throw new AdminError(422, "INVALID_INVOICE", "Choose or upload a client logo before including it.");
  }
  return {
    client_id: id(body, "client_id")!,
    project_id: id(body, "project_id", true),
    profile_id: id(body, "profile_id", true),
    invoice_number: text(body, "invoice_number", 100)!,
    created_date: createdDate,
    period_start: periodStart,
    period_end: periodEnd,
    due_date: dueDate,
    contract_name: text(body, "contract_name", 240)!,
    purchase_order: text(body, "purchase_order", 180, true),
    summary: text(body, "summary", 10_000, true),
    payment_terms: text(body, "payment_terms", 240, true),
    payment_instructions: text(body, "payment_instructions", 2_000, true),
    include_client_logo: includeClientLogo,
    client_logo_artifact_id: clientLogoArtifactId,
    summary_source_artifact_id: id(body, "summary_source_artifact_id", true),
    local_folder_name: text(body, "local_folder_name", 240, true),
    notes: text(body, "notes", 10_000, true),
    items,
    total_amount: totalAmount,
    save_profile_name: text(body, "save_profile_name", 160, true),
  };
}

async function validateRelationships(env: Env, payload: InvoiceInput): Promise<ClientRow> {
  const client = await env.DB.prepare("SELECT id, name FROM clients WHERE id = ?1 AND is_active = 1")
    .bind(payload.client_id)
    .first<ClientRow>();
  if (!client) throw new AdminError(422, "INVALID_INVOICE", "Choose an active client.");
  if (payload.project_id) {
    const project = await env.DB.prepare("SELECT client_id FROM projects WHERE id = ?1")
      .bind(payload.project_id)
      .first<ProjectRow>();
    if (!project || project.client_id !== payload.client_id) {
      throw new AdminError(422, "INVALID_INVOICE", "The selected project does not belong to this client.");
    }
  }
  for (const [artifactId, type] of [
    [payload.client_logo_artifact_id, "logo"],
    [payload.summary_source_artifact_id, "summary"],
  ] as const) {
    if (!artifactId) continue;
    const artifact = await env.DB.prepare(
      "SELECT id, client_id, artifact_type FROM client_artifacts WHERE id = ?1 AND is_current = 1",
    ).bind(artifactId).first<ArtifactRow>();
    const allowedType = type === "logo"
      ? artifact?.artifact_type === "logo"
      : artifact?.artifact_type === "contract" || artifact?.artifact_type === "mou";
    if (!artifact || artifact.client_id !== payload.client_id || !allowedType) {
      throw new AdminError(422, "INVALID_INVOICE", `The selected ${type} is not available for this client.`);
    }
  }
  return client;
}

function databaseError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (/UNIQUE constraint failed/i.test(message)) {
    throw new AdminError(409, "DUPLICATE_INVOICE", "That invoice number or saved starting-point name is already in use.");
  }
  if (/FOREIGN KEY constraint failed/i.test(message)) {
    throw new AdminError(422, "INVALID_INVOICE", "A selected client, project, file, or starting point no longer exists.");
  }
  if (/CHECK constraint failed|NOT NULL constraint failed/i.test(message)) {
    throw new AdminError(422, "INVALID_INVOICE", "Review the invoice fields and try again.");
  }
  throw error;
}

function invoiceInsert(env: Env, invoiceId: string, incomeId: string, payload: InvoiceInput, now: string) {
  return env.DB.prepare(
    `INSERT INTO invoices (
       id, owner_id, client_id, project_id, profile_id, income_id, invoice_number, created_date,
       period_start, period_end, due_date, contract_name, purchase_order, summary, payment_terms,
       payment_instructions, include_client_logo, client_logo_artifact_id, summary_source_artifact_id,
       total_amount, status, local_folder_name, notes, created_at, updated_at
     ) VALUES (
       ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15,
       ?16, ?17, ?18, ?19, ?20, 'pending', ?21, ?22, ?23, ?23
     )`,
  ).bind(
    invoiceId, OWNER_ID, payload.client_id, payload.project_id, payload.profile_id, incomeId,
    payload.invoice_number, payload.created_date, payload.period_start, payload.period_end, payload.due_date,
    payload.contract_name, payload.purchase_order, payload.summary, payload.payment_terms,
    payload.payment_instructions, payload.include_client_logo, payload.client_logo_artifact_id,
    payload.summary_source_artifact_id, payload.total_amount, payload.local_folder_name, payload.notes, now,
  );
}

function itemInsert(env: Env, invoiceId: string, item: InvoiceItemInput, index: number, now: string) {
  return env.DB.prepare(
    `INSERT INTO invoice_items (
       id, owner_id, invoice_id, sort_order, billing_type, cadence, work_type, description,
       quantity, unit_rate, line_total, created_at, updated_at
     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)`,
  ).bind(
    crypto.randomUUID(), OWNER_ID, invoiceId, index, item.billing_type, item.cadence, item.work_type,
    item.description, item.quantity, item.unit_rate, item.line_total, now,
  );
}

function profileUpsert(env: Env, payload: InvoiceInput, now: string) {
  if (!payload.save_profile_name) return null;
  const profileId = crypto.randomUUID();
  const itemsJson = JSON.stringify(payload.items.map(({ line_total: _lineTotal, ...item }) => item));
  return env.DB.prepare(
    `INSERT INTO invoice_profiles (
       id, owner_id, client_id, project_id, name, contract_name, summary_template, payment_terms,
       payment_instructions, purchase_order, include_client_logo, client_logo_artifact_id,
       summary_source_artifact_id, items_json, notes, is_active, created_at, updated_at
     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, 1, ?16, ?16)
     ON CONFLICT DO UPDATE SET
       project_id = excluded.project_id,
       contract_name = excluded.contract_name,
       summary_template = excluded.summary_template,
       payment_terms = excluded.payment_terms,
       payment_instructions = excluded.payment_instructions,
       purchase_order = excluded.purchase_order,
       include_client_logo = excluded.include_client_logo,
       client_logo_artifact_id = excluded.client_logo_artifact_id,
       summary_source_artifact_id = excluded.summary_source_artifact_id,
       items_json = excluded.items_json,
       notes = excluded.notes,
       is_active = 1,
       updated_at = excluded.updated_at`,
  ).bind(
    profileId, OWNER_ID, payload.client_id, payload.project_id, payload.save_profile_name,
    payload.contract_name, payload.summary, payload.payment_terms, payload.payment_instructions,
    payload.purchase_order, payload.include_client_logo, payload.client_logo_artifact_id,
    payload.summary_source_artifact_id, itemsJson, payload.notes, now,
  );
}

async function invoiceResponse(env: Env, idValue: string, status = 200): Promise<Response> {
  const invoice = await env.DB.prepare("SELECT * FROM invoices WHERE id = ?1").bind(idValue).first();
  if (!invoice) throw new AdminError(404, "NOT_FOUND", "That invoice no longer exists.");
  const items = await env.DB.prepare("SELECT * FROM invoice_items WHERE invoice_id = ?1 ORDER BY sort_order")
    .bind(idValue)
    .all();
  return adminJson({ invoice: { ...invoice, items: items.results } }, status);
}

export async function createInvoice(request: Request, env: Env): Promise<Response> {
  const payload = normalizeInvoicePayload(await readAdminJson(request));
  const client = await validateRelationships(env, payload);
  const invoiceId = crypto.randomUUID();
  const incomeId = crypto.randomUUID();
  const now = new Date().toISOString();
  const statements = [
    env.DB.prepare(
      `INSERT INTO income (
         id, owner_id, income_date, client_id, project_id, payer_name, invoice_number, invoice_date,
         due_date, amount, payment_status, description, payment_method, tax_year, record_status,
         cpa_review, cpa_notes, notes, created_at, updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?3, ?8, ?9, 'unpaid', ?10, NULL, ?11, 'included', 0, NULL, ?12, ?13, ?13)`,
    ).bind(
      incomeId, OWNER_ID, payload.created_date, payload.client_id, payload.project_id, client.name,
      payload.invoice_number, payload.due_date, payload.total_amount, payload.contract_name,
      Number(payload.created_date.slice(0, 4)), payload.notes, now,
    ),
    invoiceInsert(env, invoiceId, incomeId, payload, now),
    ...payload.items.map((item, index) => itemInsert(env, invoiceId, item, index, now)),
  ];
  const profile = profileUpsert(env, payload, now);
  if (profile) statements.push(profile);
  statements.push(
    env.DB.prepare(
      "INSERT INTO audit_events (id, entity_type, entity_id, event_type, metadata_json, created_at) VALUES (?1, 'invoices', ?2, 'created', ?3, ?4)",
    ).bind(crypto.randomUUID(), invoiceId, JSON.stringify({ income_id: incomeId }), now),
  );
  try {
    await env.DB.batch(statements);
  } catch (error) {
    databaseError(error);
  }
  return invoiceResponse(env, invoiceId, 201);
}

export async function updateInvoice(request: Request, env: Env, invoiceId: string): Promise<Response> {
  const payload = normalizeInvoicePayload(await readAdminJson(request));
  const client = await validateRelationships(env, payload);
  const existing = await env.DB.prepare(
    `SELECT invoices.id, invoices.income_id, invoices.status,
       COALESCE((SELECT SUM(amount) FROM income_payments WHERE income_id = invoices.income_id), 0) AS paid_amount
     FROM invoices WHERE invoices.id = ?1`,
  ).bind(invoiceId).first<ExistingInvoice>();
  if (!existing) throw new AdminError(404, "NOT_FOUND", "That invoice no longer exists.");
  const now = new Date().toISOString();
  const nextStatus = existing.status === "void"
    ? "void"
    : existing.paid_amount >= payload.total_amount
      ? "paid"
      : existing.paid_amount > 0
        ? "partial"
        : payload.due_date && payload.due_date < now.slice(0, 10)
          ? "overdue"
          : "pending";
  const statements = [
    env.DB.prepare(
      `UPDATE invoices SET
         client_id = ?1, project_id = ?2, profile_id = ?3, invoice_number = ?4, created_date = ?5,
         period_start = ?6, period_end = ?7, due_date = ?8, contract_name = ?9, purchase_order = ?10,
         summary = ?11, payment_terms = ?12, payment_instructions = ?13, include_client_logo = ?14,
         client_logo_artifact_id = ?15, summary_source_artifact_id = ?16, total_amount = ?17,
         status = ?18, local_folder_name = ?19, notes = ?20,
         paid_at = CASE WHEN ?18 = 'paid' THEN COALESCE(paid_at, ?5 || 'T12:00:00.000Z') ELSE NULL END,
         updated_at = ?21
       WHERE id = ?22`,
    ).bind(
      payload.client_id, payload.project_id, payload.profile_id, payload.invoice_number,
      payload.created_date, payload.period_start, payload.period_end, payload.due_date, payload.contract_name,
      payload.purchase_order, payload.summary, payload.payment_terms, payload.payment_instructions,
      payload.include_client_logo, payload.client_logo_artifact_id, payload.summary_source_artifact_id,
      payload.total_amount, nextStatus, payload.local_folder_name, payload.notes, now, invoiceId,
    ),
    env.DB.prepare(
      `UPDATE income SET income_date = ?1, client_id = ?2, project_id = ?3, payer_name = ?4,
         invoice_number = ?5, invoice_date = ?1, due_date = ?6, amount = ?7, description = ?8,
         tax_year = ?9, notes = ?10, updated_at = ?11 WHERE id = ?12`,
    ).bind(
      payload.created_date, payload.client_id, payload.project_id, client.name, payload.invoice_number,
      payload.due_date, payload.total_amount, payload.contract_name, Number(payload.created_date.slice(0, 4)),
      payload.notes, now, existing.income_id,
    ),
    env.DB.prepare("DELETE FROM invoice_items WHERE invoice_id = ?1").bind(invoiceId),
    ...payload.items.map((item, index) => itemInsert(env, invoiceId, item, index, now)),
  ];
  const profile = profileUpsert(env, payload, now);
  if (profile) statements.push(profile);
  statements.push(
    env.DB.prepare(
      "INSERT INTO audit_events (id, entity_type, entity_id, event_type, metadata_json, created_at) VALUES (?1, 'invoices', ?2, 'updated', NULL, ?3)",
    ).bind(crypto.randomUUID(), invoiceId, now),
  );
  try {
    await env.DB.batch(statements);
  } catch (error) {
    databaseError(error);
  }
  return invoiceResponse(env, invoiceId);
}

export async function markInvoicePaid(request: Request, env: Env, invoiceId: string): Promise<Response> {
  const body = await readAdminJson(request);
  const paymentDate = date(body, "payment_date")!;
  const paymentMethod = text(body, "payment_method", 100, true);
  const referenceNumber = text(body, "reference_number", 180, true);
  const notes = text(body, "notes", 2_000, true);
  const existing = await env.DB.prepare(
    `SELECT invoices.id, invoices.income_id, invoices.status, invoices.total_amount,
       COALESCE((SELECT SUM(amount) FROM income_payments WHERE income_id = invoices.income_id), 0) AS paid_amount
     FROM invoices WHERE invoices.id = ?1`,
  ).bind(invoiceId).first<ExistingInvoice & { total_amount: number }>();
  if (!existing) throw new AdminError(404, "NOT_FOUND", "That invoice no longer exists.");
  if (existing.status === "void") throw new AdminError(409, "VOID_INVOICE", "A void invoice cannot be marked paid.");
  const outstanding = moneyRound(existing.total_amount - existing.paid_amount);
  if (outstanding <= 0) return invoiceResponse(env, invoiceId);
  const now = new Date().toISOString();
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO income_payments (
           id, owner_id, income_id, payment_date, amount, payment_method, reference_number, notes, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)`,
      ).bind(
        crypto.randomUUID(), OWNER_ID, existing.income_id, paymentDate, outstanding,
        paymentMethod, referenceNumber, notes, now,
      ),
      env.DB.prepare(
        "INSERT INTO audit_events (id, entity_type, entity_id, event_type, metadata_json, created_at) VALUES (?1, 'invoices', ?2, 'marked_paid', ?3, ?4)",
      ).bind(crypto.randomUUID(), invoiceId, JSON.stringify({ amount: outstanding, payment_date: paymentDate }), now),
    ]);
  } catch (error) {
    databaseError(error);
  }
  return invoiceResponse(env, invoiceId);
}

export async function deleteInvoiceProfile(env: Env, profileId: string): Promise<Response> {
  const result = await env.DB.prepare(
    "UPDATE invoice_profiles SET is_active = 0, updated_at = ?1 WHERE id = ?2",
  ).bind(new Date().toISOString(), profileId).run();
  if (!result.meta.changes) throw new AdminError(404, "NOT_FOUND", "That saved starting point no longer exists.");
  return adminJson({ success: true });
}
