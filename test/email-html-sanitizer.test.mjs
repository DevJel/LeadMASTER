import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeGeneratedEmailHtml } from "../src/email-html-sanitizer.mjs";

test("email sanitizer keeps ordinary email markup and inline styling",()=>{
  const safe=sanitizeGeneratedEmailHtml('<table style="font-family:Arial"><tr><td><h1>Hello</h1><a href="https://example.com">Read more</a></td></tr></table>');
  assert.match(safe,/<table/);
  assert.match(safe,/font-family:Arial/);
  assert.match(safe,/https:\/\/example\.com/);
});

test("email sanitizer strips executable and embedding elements",()=>{
  const safe=sanitizeGeneratedEmailHtml('<table><tr><td>OK</td></tr></table><script>alert(1)</script><iframe src="https://evil.test"></iframe><form><input></form><svg onload="alert(1)"></svg>');
  assert.match(safe,/OK/);
  assert.doesNotMatch(safe,/<script|<iframe|<form|<svg|onload/i);
});

test("email sanitizer removes event handlers and unsafe link targets",()=>{
  const safe=sanitizeGeneratedEmailHtml('<a href="javascript:alert(1)" onclick="steal()">Click</a><img src=data:text/html,xxx onerror=alert(1)>');
  assert.doesNotMatch(safe,/javascript:|data:text\/html|onclick|onerror/i);
  assert.match(safe,/href="#"/);
});

test("email sanitizer bounds generated output",()=>{
  assert.ok(sanitizeGeneratedEmailHtml("x".repeat(30000)).length<=24000);
  assert.equal(sanitizeGeneratedEmailHtml(""),"");
});
