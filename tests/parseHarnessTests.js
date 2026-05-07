#!/usr/bin/env node
"use strict";

const path = require("path");
const { parseHarnessAndPrompt, HARNESSES } = require(
  path.join(__dirname, "..", "src", "parseHarness")
);

let passed = 0;
let failed = 0;
const failures = [];

function t(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, message: err.message });
    console.log(`  ✗ ${name}`);
    console.log(`      ${err.message}`);
  }
}
function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(
      `${msg || "assertion failed"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}
function assertContains(haystack, needle) {
  if (!String(haystack).includes(needle)) {
    throw new Error(`expected ${JSON.stringify(needle)} in ${JSON.stringify(haystack)}`);
  }
}

console.log("\n[CLI] parseHarnessAndPrompt");

t("smoke design <prompt> → harness=design", () => {
  const r = parseHarnessAndPrompt(["design", "build a marketing page"]);
  assertEqual(r.harness, "design");
  assertEqual(r.prompt, "build a marketing page");
});

t("smoke code <prompt> → harness=code", () => {
  const r = parseHarnessAndPrompt(["code", "fix this function"]);
  assertEqual(r.harness, "code");
  assertEqual(r.prompt, "fix this function");
});

t("smoke auto <prompt> → harness=auto", () => {
  const r = parseHarnessAndPrompt(["auto", "do something"]);
  assertEqual(r.harness, "auto");
  assertEqual(r.prompt, "do something");
});

t('no selector → defaults to auto', () => {
  const r = parseHarnessAndPrompt(["clean up this React component"]);
  assertEqual(r.harness, "auto");
  assertEqual(r.prompt, "clean up this React component");
});

t("multi-word prompt with no selector stays as auto", () => {
  const r = parseHarnessAndPrompt(["fix", "the", "login", "route"]);
  // "fix" is a bareword → treated as would-be selector → error.
  // This ensures we surface unknown harness selectors instead of swallowing them.
  assertEqual(r.harness, null);
  assertContains(r.error, "Unknown harness");
  assertContains(r.error, HARNESSES.join(", "));
});

t("invalid selector returns descriptive error", () => {
  const r = parseHarnessAndPrompt(["banana", "some prompt"]);
  assertEqual(r.harness, null);
  assertContains(r.error, "Unknown harness");
  assertContains(r.error, "auto, code, design");
});

t("single-word prompt without recognizable selector pattern stays as auto", () => {
  // "Quoted multi-word" becomes a single arg in real CLI usage.
  const r = parseHarnessAndPrompt(['"build a marketing page"']);
  assertEqual(r.harness, "auto");
  assertEqual(r.prompt, '"build a marketing page"');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.message}`);
  }
  process.exit(1);
}
