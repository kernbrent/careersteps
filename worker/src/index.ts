import {
  AdminError,
  adminJson,
  authenticate,
  changePassword,
  isAllowedOrigin,
  login,
  logout,
  requireAllowedOrigin,
  sessionInfo,
} from "./security";
import { deleteAttachment, downloadAttachment, uploadAttachment } from "./attachments";
import {
  bookkeepingData,
  createRecord,
  deleteRecord,
  recordTable,
  updateRecord,
  updateSettings,
} from "./records";
import { createTripBatch } from "./trips";

function routePath(pathname: string): string {
  const stripped = pathname.replace(/^\/api\/admin(?=\/|$)/, "");
  return stripped || "/";
}

function decodedId(value: string): string {
  let decoded = "";
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new AdminError(400, "INVALID_ID", "That record reference is invalid.");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{7,79}$/.test(decoded)) {
    throw new AdminError(400, "INVALID_ID", "That record reference is invalid.");
  }
  return decoded;
}

async function requireMutation(request: Request, env: Env): Promise<void> {
  requireAllowedOrigin(request, env);
  await authenticate(request, env, true);
}

async function route(request: Request, env: Env, path: string, url: URL): Promise<Response> {
  if (request.method === "POST" && path === "/login") return login(request, env);
  if (request.method === "GET" && path === "/session") return sessionInfo(request, env);
  if (request.method === "POST" && path === "/logout") return logout(request, env);
  if (request.method === "POST" && path === "/password") return changePassword(request, env);

  if (request.method === "GET" && path === "/data") {
    await authenticate(request, env);
    return bookkeepingData(env);
  }
  if (request.method === "PATCH" && path === "/settings") {
    await requireMutation(request, env);
    return updateSettings(request, env);
  }
  if (request.method === "POST" && path === "/attachments") {
    await requireMutation(request, env);
    return uploadAttachment(request, env, url);
  }
  if (request.method === "POST" && path === "/trips/batch") {
    await requireMutation(request, env);
    return createTripBatch(request, env);
  }

  const attachmentMatch = path.match(/^\/attachments\/([^/]+)$/);
  if (attachmentMatch?.[1]) {
    const id = decodedId(attachmentMatch[1]);
    if (request.method === "GET") {
      await authenticate(request, env);
      return downloadAttachment(env, id);
    }
    if (request.method === "DELETE") {
      await requireMutation(request, env);
      return deleteAttachment(env, id);
    }
  }

  const recordsMatch = path.match(/^\/records\/([a-z_]+)(?:\/([^/]+))?$/);
  if (recordsMatch?.[1]) {
    const table = recordTable(recordsMatch[1]);
    if (!table) throw new AdminError(404, "NOT_FOUND", "Not found.");
    if (request.method === "POST" && !recordsMatch[2]) {
      await requireMutation(request, env);
      return createRecord(request, env, table);
    }
    if (recordsMatch[2]) {
      const id = decodedId(recordsMatch[2]);
      if (request.method === "PATCH") {
        await requireMutation(request, env);
        return updateRecord(request, env, table, id);
      }
      if (request.method === "DELETE") {
        await requireMutation(request, env);
        return deleteRecord(env, table, id);
      }
    }
  }

  throw new AdminError(404, "NOT_FOUND", "Not found.");
}

function withCors(response: Response, request: Request, env: Env): Response {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin, env.ALLOWED_ORIGINS)) return response;
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin!);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.append("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = routePath(url.pathname);
    if (!url.pathname.startsWith("/api/admin/")) {
      return adminJson({ error: "Not found.", code: "NOT_FOUND" }, 404);
    }
    if (request.method === "OPTIONS") {
      const origin = request.headers.get("origin");
      if (!isAllowedOrigin(origin, env.ALLOWED_ORIGINS)) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin!,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token, X-File-Name",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
          "Access-Control-Max-Age": "600",
          "Vary": "Origin",
        },
      });
    }
    let response: Response;
    try {
      response = await route(request, env, path, url);
    } catch (error) {
      if (error instanceof AdminError) {
        if (error.status >= 500) {
          console.error(JSON.stringify({ event: "admin_request_failed", code: error.code, path }));
        }
        response = adminJson({ error: error.message, code: error.code }, error.status, error.headers);
      } else {
        console.error(JSON.stringify({
          event: "admin_unhandled_error",
          path,
          message: error instanceof Error ? error.message : "Unknown error",
        }));
        response = adminJson({ error: "The Admin Portal encountered an unexpected error.", code: "SERVER_ERROR" }, 500);
      }
    }
    return withCors(response, request, env);
  },
} satisfies ExportedHandler<Env>;

export { routePath };
export { adminPasswordPolicyError, deriveAdminPasswordHash, isAllowedOrigin, secureEqual } from "./security";
export { normalizeRecordPayload, recordTable } from "./records";
export { normalizeTripBatchPayload } from "./trips";
