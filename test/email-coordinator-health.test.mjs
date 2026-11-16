import test from "node:test";
import assert from "node:assert/strict";
import { EmailCoordinator } from "../src/email-coordinator.mjs";

test("internal coordinator health reports SMTP readiness without exposing secret values", async () => {
  const env = {
    SES_SMTP_HOST: "email-smtp.ap-southeast-2.amazonaws.com",
    SES_SMTP_USERNAME: "smtp-user-secret",
    SES_SMTP_PASSWORD: "smtp-password-secret",
    SES_FROM_EMAIL: "noreply@leadmaster.jelvan.pro"
  };
  const coordinator = new EmailCoordinator({ storage: {} }, env);
  const response = await coordinator.fetch(new Request("https://internal/health"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body, { status: "healthy", smtpConfigured: true, fromConfigured: true });
  assert.equal(JSON.stringify(body).includes("smtp-user-secret"), false);
  assert.equal(JSON.stringify(body).includes("smtp-password-secret"), false);
});

test("internal coordinator health fails closed when an SMTP credential is missing", async () => {
  const coordinator = new EmailCoordinator({ storage: {} }, {
    SES_SMTP_HOST: "smtp.example.com",
    SES_SMTP_USERNAME: "",
    SES_SMTP_PASSWORD: "secret",
    SES_FROM_EMAIL: "noreply@leadmaster.jelvan.pro"
  });
  const response = await coordinator.fetch(new Request("https://internal/health"));
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.status, "misconfigured");
  assert.equal(body.smtpConfigured, false);
});
