import test from "node:test";
import assert from "node:assert/strict";
import { runDailyReporter } from "../src/daily-reporter.mjs";
import { validateEmailJob, EmailDispatchCore } from "../src/email-queue-core.mjs";
import { sendSesEmail } from "../src/ses-smtp.mjs";
import { withSenderSignature } from "../src/email-signatures.mjs";

const TABLES = [
  "accounts", "account_members", "auth_challenges", "auth_sessions",
  "admin_sent_mail", "mail_notifications", "email_templates", "inbound_mail",
  "email_delivery_events", "developer_api_keys", "developer_email_requests",
  "developer_webhooks", "leadmaster_records", "leadmaster_reporter_runs"
];

function fakeDatabase() {
  const state = { run: null, updates: [] };
  return {
    state,
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() {
              if (sql.includes("SELECT status,email_status,started_at")) return state.run;
              return null;
            },
            async all() {
              if (sql.includes("sqlite_master")) return { results: TABLES.map(name => ({ name })) };
              return { results: [] };
            },
            async run() {
              if (sql.startsWith("INSERT INTO leadmaster_reporter_runs")) {
                if (!state.run) state.run = { status: "running", email_status: "not_attempted", started_at: params[2] };
                else if (state.run.email_status === "not_accepted") state.run = { status: "running", email_status: "not_attempted", started_at: params[2] };
              } else if (sql.startsWith("UPDATE leadmaster_reporter_runs")) {
                state.run = {
                  status: params[0], completed_at: params[1], total_checks: params[2],
                  healthy_count: params[3], fixed_count: params[4], moderate_count: params[5],
                  attention_count: params[6], manual_count: params[7], unable_count: params[8],
                  email_status: params[9], email_message_id: params[10], report_json: params[11],
                  error_summary: params[12], report_date: params[13], started_at: state.run?.started_at
                };
                state.updates.push(state.run);
              }
              return { success: true };
            }
          };
        }
      };
    }
  };
}

function responseJson(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", ...headers } });
}

function createEnv(options = {}) {
  const db = fakeDatabase();
  const sent = [];
  const calls = new Map();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    if (url.hostname === "leadmaster.jelvan.space") {
      if (url.pathname === "/" || url.pathname === "/login.html") return new Response("ok", { status: 200 });
      const count = (calls.get(url.pathname) || 0) + 1;
      calls.set(url.pathname, count);
      if (url.pathname === "/api/auth/config") {
        if (options.recoverAuth && count === 1) return responseJson({ error: "temporary" }, 503);
        return responseJson({ turnstileSiteKey: "0x4AAAAAAF6m40DGlxOgE2qB" });
      }
      if (url.pathname === "/api/auth/session") return responseJson({ authenticated: false });
      if (url.pathname === "/dashboard") return new Response(null, { status: 302, headers: { location: "/login.html" } });
      return responseJson({ error: "Unauthorized" }, 401);
    }
    if (url.hostname === "api.github.com") {
      if (url.pathname === "/repos/DevJel/LeadMASTER") return responseJson({ default_branch: "main", archived: false });
      if (url.pathname === "/repos/DevJel/LeadMASTER/branches/main") return responseJson({ commit: { sha: "1234567890abcdef" } });
      if (url.pathname === "/repos/DevJel/LeadMASTER/actions/runs") return responseJson({ workflow_runs: [
        { name: "LeadMASTER CI", status: "completed", conclusion: "success", head_sha: "1234567890abcdef", html_url: "https://github.com/DevJel/LeadMASTER/actions" },
        { name: "Build Android APK", status: "completed", conclusion: "success", head_sha: "1234567890abcdef", html_url: "https://github.com/DevJel/LeadMASTER/actions" }
      ] });
      if (url.pathname === "/repos/DevJel/LeadMASTER/issues") return responseJson([]);
      if (url.pathname === "/repos/DevJel/LeadMASTER/pulls") return responseJson([]);
    }
    throw new Error("Unexpected fetch in reporter test: " + url.href);
  };
  const env = {
    AUTH_DB: db,
    ADMIN_EMAIL: options.adminEmail === undefined ? "admin@example.com" : options.adminEmail,
    REPORTER_APP_URL: "https://leadmaster.jelvan.space",
    REPORTER_GITHUB_REPOSITORY: "DevJel/LeadMASTER",
    REPORTER_TIME_ZONE: "Asia/Kuala_Lumpur",
    EMAIL_COORDINATOR: {
      idFromName: name => { assert.equal(name, "ses-global"); return "global"; },
      get: id => {
        assert.equal(id, "global");
        return { fetch: async (url, init = {}) => {
          if (init.method === "GET") return responseJson({ status: "healthy", smtpConfigured: true, fromConfigured: true });
          const body = JSON.parse(init.body);
          validateEmailJob(body);
          sent.push(body);
          return responseJson({ status: "accepted" });
        } };
      }
    },
    INBOUND_MAIL: { list: async () => ({ objects: [], truncated: false }) },
    MAIL_SEND_QUEUE: { send: async () => ({}) },
    AI: {}
  };
  return { env, db, sent, calls, restore: () => { globalThis.fetch = originalFetch; } };
}

test("daily reporter creates a branded report and sends only to the configured admin", async () => {
  const f = createEnv();
  try {
    const result = await runDailyReporter(f.env, Date.UTC(2026, 10, 16, 0, 0, 0));
    assert.equal(result.status, "sent");
    assert.equal(result.reportDate, "2026-11-16");
    assert.equal(f.sent.length, 1);
    const message = f.sent[0];
    assert.equal(message.to, "admin@example.com");
    assert.equal(message.fromName, "LeadMASTER Reporter");
    assert.match(message.messageId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    assert.equal(Object.hasOwn(message, "cc"), false);
    assert.equal(Object.hasOwn(message, "bcc"), false);
    assert.match(message.subject, /REPORT OF THE DAY/);
    assert.ok(message.subject.includes("Monday, Nov. 16, 2026"));
    assert.match(message.html, /REPORT OF THE DAY/);
    assert.match(message.html, /GITHUB — REPOSITORY AND ACTIONS/);
    assert.match(message.html, /CLOUDFLARE — ACCOUNT AND RUNTIME/);
    assert.match(message.html, /APP FUNCTIONS AFFECTED/);
    assert.match(message.html, /Needs Manual Action/);
    assert.equal(f.db.state.run.email_message_id, message.messageId);
    assert.equal(f.db.state.run.email_status, "accepted");
    assert.equal(f.db.state.run.status, "sent");
  } finally { f.restore(); }
});

test("daily reporter uses in-process Worker probes instead of recursive network requests", async () => {
  const f = createEnv();
  const probed = [];
  try {
    f.env.REPORTER_INTERNAL_PROBE = async path => {
      probed.push(path);
      if (path === "/api/auth/config") return responseJson({ turnstileSiteKey: "0x4AAAAAAF6m40DGlxOgE2qB" });
      if (path === "/api/auth/session") return responseJson({ authenticated: false });
      if (path === "/dashboard") return new Response(null, { status: 302, headers: { location: "/login.html" } });
      if (path === "/" || path === "/login.html") return new Response("ok", { status: 200 });
      return new Response("Unauthorized", { status: 401 });
    };
    const result = await runDailyReporter(f.env, Date.UTC(2026, 10, 16, 9, 0, 0));
    assert.equal(result.status, "sent");
    const report = JSON.parse(f.db.state.run.report_json);
    const appChecks = report.checks.filter(item => item.area === "App Functions");
    assert.ok(appChecks.length >= 19);
    assert.ok(appChecks.every(item => item.status === "Healthy"), JSON.stringify(appChecks.filter(item => item.status !== "Healthy")));
    assert.ok(probed.includes("/api/auth/config"));
    assert.equal(f.calls.size, 0, "the app's own hostname must not be fetched recursively from its Worker");
  } finally { f.restore(); }
});

test("sample report uses a separate idempotency key and the same admin-only SES route", async () => {
  const f = createEnv();
  try {
    const result = await runDailyReporter(f.env, Date.UTC(2026, 10, 16, 9, 0, 0), { sample: true, sampleId: "sample-check-1" });
    assert.equal(result.status, "sent");
    assert.equal(f.sent.length, 1);
    assert.equal(f.sent[0].to, "admin@example.com");
    assert.match(f.sent[0].subject, /LEADMASTER REPORT SAMPLE/);
    assert.equal(f.db.state.run.email_status, "accepted");
    assert.match(f.db.state.run.report_date, /-sample-sample-check-1$/);
  } finally { f.restore(); }
});

test("reporter is idempotent and never sends a second daily email after acceptance", async () => {
  const f = createEnv();
  try {
    await runDailyReporter(f.env, Date.UTC(2026, 10, 16, 0, 0, 0));
    const second = await runDailyReporter(f.env, Date.UTC(2026, 10, 16, 1, 0, 0));
    assert.equal(second.skipped, true);
    assert.equal(f.sent.length, 1);
  } finally { f.restore(); }
});

test("reporter records a transient recovery as Fixed", async () => {
  const f = createEnv({ recoverAuth: true });
  try {
    await runDailyReporter(f.env, Date.UTC(2026, 10, 16, 0, 0, 0));
    const report = JSON.parse(f.db.state.run.report_json);
    const check = report.checks.find(item => item.name === "Public authentication configuration");
    assert.equal(check.status, "Fixed");
    assert.match(check.detail, /automatic verification retry/);
  } finally { f.restore(); }
});

test("reporter fails closed and does not send when the admin recipient secret is missing", async () => {
  const f = createEnv({ adminEmail: null });
  try {
    const result = await runDailyReporter(f.env, Date.UTC(2026, 10, 16, 0, 0, 0));
    assert.equal(result.status, "not_sent");
    assert.equal(f.sent.length, 0);
    const report = JSON.parse(f.db.state.run.report_json);
    const check = report.checks.find(item => item.name === "Admin-only report recipient");
    assert.equal(check.status, "Unable to Fix");
  } finally { f.restore(); }
});

test("real report payload passes coordinator and mock SMTP, with stable idempotency", async () => {
  const f=createEnv(), commands=[];let smtpConnections=0;
  const mailEnv={SES_SMTP_HOST:"email-smtp.us-east-1.amazonaws.com",SES_SMTP_USERNAME:"test-user",SES_SMTP_PASSWORD:"test-password",SES_FROM_EMAIL:"sender@example.com"};
  function socket(secure){let controller;const readable=new ReadableStream({start(c){controller=c;if(!secure)c.enqueue(new TextEncoder().encode("220 ready\r\n"))}});
   const writable=new WritableStream({write(bytes){const value=new TextDecoder().decode(bytes);commands.push(value);const reply=value.startsWith("EHLO")?"250 ready":value.startsWith("STARTTLS")?"220 go":value.startsWith("AUTH")?"235 ok":value.startsWith("DATA")?"354 continue":"250 accepted";controller.enqueue(new TextEncoder().encode(reply+"\r\n"))}});
   return {opened:Promise.resolve(),readable,writable,startTls:()=>socket(true),close:async()=>{}};
  }
  class Storage {constructor(){this.data=new Map()}async get(key){return this.data.get(key)}async put(key,value){this.data.set(key,value)}async transaction(fn){return fn(this)}}
  const core=new EmailDispatchCore({storage:new Storage(),send:job=>sendSesEmail({env:mailEnv,connect:()=>{smtpConnections++;return socket(false)},...withSenderSignature(job)})});
  f.env.EMAIL_COORDINATOR={idFromName:()=>"global",get:()=>({fetch:async(_url,init)=>{
   if(init.method==="GET")return responseJson({status:"healthy",smtpConfigured:true,fromConfigured:true});
   try{return responseJson(await core.dispatch(JSON.parse(init.body)))}catch{return responseJson({status:"invalid_request"},400)}
  }})};
  try {const first=await runDailyReporter(f.env,Date.UTC(2026,10,16,9));assert.equal(first.status,"sent");assert.equal(smtpConnections,1);assert.match(commands.at(-1),/From: LeadMASTER Reporter <sender@example.com>/);
    const second=await runDailyReporter(f.env,Date.UTC(2026,10,16,9));assert.equal(second.skipped,true);assert.equal(smtpConnections,1);
  } finally {f.restore()}
});
