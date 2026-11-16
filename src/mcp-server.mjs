/** Account-scoped MCP endpoint. Every tool delegates to the same scoped REST handlers. */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod/v4";
import { validateEmailJob } from "./email-queue-core.mjs";
import { developerEmailRoute, developerEmailStatus } from "./developer-api.mjs";
import { webhookRoute } from "./developer-webhooks.mjs";

const MAX_BODY = 100000;
const encoder = new TextEncoder();
const reply = (body, status, headers = {}) => Response.json(body, {
  status,
  headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers }
});
const toolText = value => ({ content: [{ type: "text", text: JSON.stringify(value) }] });

async function boundedBody(request) {
  if (!request.body) throw new TypeError("Missing body");
  const reader = request.body.getReader(), chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) {
        try { await reader.cancel(); } catch {}
        throw new RangeError("Too large");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

async function authenticate(request, env) {
  const match = /^Bearer (lm_live_[A-Za-z0-9_-]{43})$/.exec(request.headers.get("authorization") || "");
  if (!match || !env?.AUTH_DB) return null;
  const apiKey = match[1];
  const row = await env.AUTH_DB.prepare(
    "SELECT id,key_hash,scopes,revoked_at,account_id FROM developer_api_keys WHERE key_prefix=?"
  ).bind(apiKey.slice(0, 16)).first();
  if (!row || row.revoked_at || typeof row.account_id !== "string") return null;
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(apiKey));
  const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  if (actual.length !== String(row.key_hash || "").length) return null;
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ row.key_hash.charCodeAt(i);
  if (difference !== 0) return null;
  let scopes;
  try { scopes = JSON.parse(row.scopes || "[]"); } catch { return null; }
  if (!Array.isArray(scopes) || scopes.some(scope => typeof scope !== "string")) return null;
  return { apiKey, keyId: row.id, accountId: row.account_id, scopes };
}

function requestFor(path, method, apiKey, body, idempotencyKey) {
  const headers = { authorization: "Bearer " + apiKey };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
  return new Request("https://leadmaster.jelvan.pro" + path, {
    method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

async function routeResult(response) {
  const data = await response.json().catch(() => ({ error: "The integration returned an unreadable response." }));
  return toolText({ http_status: response.status, ...data });
}

function makeServer(env, principal) {
  const { apiKey, accountId, scopes } = principal;
  const server = new McpServer({ name: "leadmaster", version: "1.0.0" });
  const has = scope => scopes.includes(scope);
  const available = [
    "get_email_capabilities",
    "validate_email",
    ...(has("email:send") ? ["send_email"] : []),
    ...(has("email:read") ? ["get_email_status"] : []),
    ...(has("webhook:manage") ? ["list_webhooks", "create_webhook", "revoke_webhook", "list_webhook_deliveries"] : [])
  ];

  server.registerTool("get_email_capabilities", {
    title: "Get LeadMASTER capabilities",
    description: "List the account-scoped tools enabled for this API key.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
  }, async () => toolText({
    service: "LeadMASTER",
    transport: "MCP Streamable HTTP",
    account_id: accountId,
    scopes,
    tools: available,
    note: "All tools use the authenticated API key's account and scopes. This connection does not expose the private mailbox or administrator settings."
  }));

  server.registerTool("validate_email", {
    title: "Validate an email",
    description: "Validate an email payload against LeadMASTER queue input rules. Does not send or store the message.",
    inputSchema: {
      to: z.string().max(254),
      subject: z.string().max(300),
      text: z.string().max(100000),
      html: z.string().max(100000).optional()
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
  }, async ({ to, subject, text, html }) => {
    const job = { id: "mcp-validation", to, subject, text, ...(html === undefined ? {} : { html }) };
    try {
      validateEmailJob(job);
      if (encoder.encode(JSON.stringify(job)).length > MAX_BODY) throw new Error("Too large");
      return toolText({ valid: true, sent: false, note: "Validation only. Sender authorization, consent and delivery are checked separately by the send workflow." });
    } catch {
      return toolText({ valid: false, sent: false, note: "The message does not meet LeadMASTER email input requirements." });
    }
  });

  if (has("email:send")) {
    server.registerTool("send_email", {
      title: "Submit an email through LeadMASTER",
      description: "Submit one transactional email to the authenticated account's LeadMASTER sending queue. Use only when the user explicitly requests sending and has confirmed the exact recipient and content. Always provide a stable unique idempotency_key and reconcile uncertain outcomes before retrying. This action queues a message; it does not prove delivery.",
      inputSchema: {
        to: z.string().email().max(254),
        subject: z.string().min(1).max(300),
        text: z.string().max(100000),
        html: z.string().max(100000).optional(),
        sender_name: z.string().max(80).optional(),
        reply_to: z.string().email().max(254).optional(),
        idempotency_key: z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/)
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false }
    }, async ({ to, subject, text, html, sender_name, reply_to, idempotency_key }) => {
      const body = { to, subject, text, ...(html === undefined ? {} : { html }), ...(sender_name ? { sender_name } : {}), ...(reply_to ? { reply_to } : {}) };
      const request = requestFor("/api/v1/accounts/" + encodeURIComponent(accountId) + "/emails", "POST", apiKey, body, idempotency_key);
      return routeResult(await developerEmailRoute(request, env, null, accountId));
    });
  }

  if (has("email:read")) {
    server.registerTool("get_email_status", {
      title: "Get email request status",
      description: "Read the status of an email submitted with this same API key. Does not expose other keys' requests or the private inbox.",
      inputSchema: { id: z.string().uuid() },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
    }, async ({ id }) => {
      const request = requestFor("/api/v1/accounts/" + encodeURIComponent(accountId) + "/emails/" + encodeURIComponent(id), "GET", apiKey);
      return routeResult(await developerEmailStatus(request, env, accountId));
    });
  }

  if (has("webhook:manage")) {
    server.registerTool("list_webhooks", {
      title: "List webhook subscriptions",
      description: "List webhook endpoints created by this API key in the authenticated account.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
    }, async () => routeResult(await webhookRoute(requestFor("/api/v1/accounts/" + encodeURIComponent(accountId) + "/webhooks", "GET", apiKey), env, accountId)));

    server.registerTool("create_webhook", {
      title: "Create an email event webhook",
      description: "Register an HTTPS callback for LeadMASTER email.accepted, email.failed or email.unknown events. The signing_secret is returned once; copy it into the callback server's secret manager.",
      inputSchema: {
        name: z.string().min(1).max(80),
        url: z.string().url().max(2048),
        events: z.array(z.enum(["email.accepted", "email.failed", "email.unknown"])).min(1).max(3)
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
    }, async ({ name, url, events }) => routeResult(await webhookRoute(
      requestFor("/api/v1/accounts/" + encodeURIComponent(accountId) + "/webhooks", "POST", apiKey, { name, url, events }), env, accountId
    )));

    server.registerTool("revoke_webhook", {
      title: "Revoke a webhook subscription",
      description: "Revoke one webhook created by this API key. This stops future event callbacks to that endpoint.",
      inputSchema: { id: z.string().uuid() },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false }
    }, async ({ id }) => routeResult(await webhookRoute(
      requestFor("/api/v1/accounts/" + encodeURIComponent(accountId) + "/webhooks/" + encodeURIComponent(id), "DELETE", apiKey), env, accountId
    )));

    server.registerTool("list_webhook_deliveries", {
      title: "List webhook delivery attempts",
      description: "Inspect up to 50 recorded delivery attempts for a webhook owned by this API key.",
      inputSchema: { id: z.string().uuid() },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
    }, async ({ id }) => routeResult(await webhookRoute(
      requestFor("/api/v1/accounts/" + encodeURIComponent(accountId) + "/webhooks/" + encodeURIComponent(id) + "/deliveries", "GET", apiKey), env, accountId
    )));
  }
  return server;
}

export async function handleMcp(request, env) {
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405, { allow: "POST" });
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "")) return reply({ error: "Content-Type must be application/json" }, 415);
  const origin = request.headers.get("origin");
  if (origin && (!env?.MCP_ALLOWED_ORIGIN || origin !== env.MCP_ALLOWED_ORIGIN)) return reply({ error: "Forbidden" }, 403);
  const principal = await authenticate(request, env);
  if (!principal) return reply({ error: "A valid LeadMASTER developer API key is required." }, 401, { "www-authenticate": "Bearer" });

  try {
    const now = Date.now(), windowStart = now - 60000;
    const rate = await env.AUTH_DB.prepare(
      "INSERT INTO auth_rate_limits (bucket_key,window_start,count) VALUES (?, ?, 1) ON CONFLICT(bucket_key) DO UPDATE SET count=CASE WHEN auth_rate_limits.window_start<=? THEN 1 ELSE auth_rate_limits.count+1 END, window_start=CASE WHEN auth_rate_limits.window_start<=? THEN excluded.window_start ELSE auth_rate_limits.window_start END RETURNING count"
    ).bind("mcp:" + principal.keyId, now, windowStart, windowStart).first();
    if (Number(rate?.count || 0) > 60) return reply({ error: "MCP request limit reached." }, 429, { "retry-after": "60" });
  } catch { return reply({ error: "MCP rate control is temporarily unavailable." }, 503); }

  let bytes;
  try { bytes = await boundedBody(request); }
  catch (error) { return reply({ error: "Invalid MCP request body." }, error instanceof RangeError ? 413 : 400); }
  try {
    const server = makeServer(env, principal);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    const safeRequest = new Request(request.url, { method: "POST", headers: request.headers, body: bytes });
    const result = await transport.handleRequest(safeRequest);
    const headers = new Headers(result.headers);
    headers.set("cache-control", "no-store");
    headers.set("x-content-type-options", "nosniff");
    return new Response(result.body, { status: result.status, statusText: result.statusText, headers });
  } catch (error) {
    console.error("LEADMASTER_MCP_REQUEST_FAILED", JSON.stringify({ accountId: principal.accountId, reason: String(error?.message || "unknown").slice(0, 160) }));
    return reply({ error: "MCP service is temporarily unavailable." }, 503);
  }
}
