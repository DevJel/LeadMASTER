import test from "node:test";
import assert from "node:assert/strict";
import {createGravatarHash, createGravatarAvatarUrl, normalizeGravatarEmail} from "../src/gravatar.mjs";

test("normalizes email before hashing", () => {
  assert.equal(normalizeGravatarEmail(" MyEmailAddress@example.com "), "myemailaddress@example.com");
});

test("uses the documented SHA-256 Gravatar hash", async () => {
  assert.equal(await createGravatarHash("MyEmailAddress@example.com "), "84059b07d4be67b806386c0aad8070a23f18836bbaae342275dc0a83414c32ee");
});

test("returns a size-bounded avatar URL containing only the hash", async () => {
  const url = await createGravatarAvatarUrl("MyEmailAddress@example.com ", 80);
  assert.equal(url, "https://gravatar.com/avatar/84059b07d4be67b806386c0aad8070a23f18836bbaae342275dc0a83414c32ee?s=80&d=404");
  assert.equal(url.includes("MyEmailAddress"), false);
});

test("rejects malformed or missing email addresses", async () => {
  assert.equal(await createGravatarHash("not-an-email"), null);
  assert.equal(await createGravatarAvatarUrl("", 80), null);
});
