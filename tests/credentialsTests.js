#!/usr/bin/env node
"use strict";

const path = require("path");
const { resolveApiKey, ACTIVATION_GUIDANCE } = require(
  path.join(__dirname, "..", "src", "credentials")
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
function assertNotContains(haystack, needle) {
  if (String(haystack).includes(needle)) {
    throw new Error(
      `did not expect ${JSON.stringify(needle)} in ${JSON.stringify(haystack)}`
    );
  }
}

console.log("\n[CLI] resolveApiKey");

t("activated config without env var allows compile (stored key used)", () => {
  const r = resolveApiKey({
    readEnv: () => undefined,
    readActivation: () => ({ apiKey: "stored-key-abc" })
  });
  assertEqual(r.apiKey, "stored-key-abc");
  assertEqual(r.source, "activation");
});

t("env var overrides stored key", () => {
  const r = resolveApiKey({
    readEnv: () => "env-key-xyz",
    readActivation: () => ({ apiKey: "stored-key-abc" })
  });
  assertEqual(r.apiKey, "env-key-xyz");
  assertEqual(r.source, "env");
});

t("missing env + missing stored key returns activation guidance", () => {
  const r = resolveApiKey({
    readEnv: () => undefined,
    readActivation: () => null
  });
  assertEqual(r.apiKey, null);
  assertEqual(r.error, ACTIVATION_GUIDANCE);
  assertEqual(
    r.error,
    "TokenSmoker is not activated. Run: tokensmoker activate"
  );
});

t("activation present but no apiKey field returns activation guidance", () => {
  const r = resolveApiKey({
    readEnv: () => undefined,
    readActivation: () => ({ name: "x", email: "y", status: "trial" })
  });
  assertEqual(r.apiKey, null);
  assertEqual(r.error, ACTIVATION_GUIDANCE);
});

t("empty env var falls through to stored key", () => {
  const r = resolveApiKey({
    readEnv: () => "   ",
    readActivation: () => ({ apiKey: "stored-key-abc" })
  });
  assertEqual(r.apiKey, "stored-key-abc");
  assertEqual(r.source, "activation");
});

t("trims whitespace from env key", () => {
  const r = resolveApiKey({
    readEnv: () => "  env-key  ",
    readActivation: () => null
  });
  assertEqual(r.apiKey, "env-key");
});

t("error message does not include any key value", () => {
  const r = resolveApiKey({
    readEnv: () => undefined,
    readActivation: () => null
  });
  assertNotContains(r.error || "", "key-");
  assertNotContains(r.error || "", "Bearer");
});

console.log("\n[CLI] activate persistence shape");

const fs = require("fs");
const os = require("os");
const tmp = require("os").tmpdir();
const tmpHome = path.join(tmp, `ts-activate-${process.pid}-${Date.now()}`);

t("activation.json round-trip exposes apiKey but not in console output", () => {
  // Simulate what activate.js writes; verify resolveApiKey can read it back.
  fs.mkdirSync(path.join(tmpHome, ".tokensmoker"), { recursive: true });
  const filePath = path.join(tmpHome, ".tokensmoker", "activation.json");
  const data = {
    name: "Test User",
    email: "test@example.com",
    apiKey: "secret-key-12345",
    status: "trial",
    activatedAt: new Date().toISOString()
  };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  const r = resolveApiKey({
    readEnv: () => undefined,
    readActivation: () => JSON.parse(fs.readFileSync(filePath))
  });
  assertEqual(r.apiKey, "secret-key-12345");
  assertEqual(r.source, "activation");

  fs.rmSync(tmpHome, { recursive: true, force: true });
});

t("status output does not print apiKey", () => {
  // Snapshot stdout, run status against a temp activation, ensure key absent.
  const { status } = require(path.join(__dirname, "..", "src", "status"));
  const realHome = os.homedir();
  process.env.HOME = tmpHome;

  fs.mkdirSync(path.join(tmpHome, ".tokensmoker"), { recursive: true });
  const filePath = path.join(tmpHome, ".tokensmoker", "activation.json");
  const data = {
    name: "Test User",
    email: "test@example.com",
    apiKey: "do-not-print-this-key",
    status: "trial",
    activatedAt: new Date().toISOString()
  };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  const captured = [];
  const origLog = console.log;
  console.log = (...args) => captured.push(args.join(" "));

  let output = "";
  try {
    status();
    output = captured.join("\n");
  } finally {
    console.log = origLog;
    process.env.HOME = realHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }

  assertNotContains(output, "do-not-print-this-key");
  assertNotContains(output, "apiKey");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.message}`);
  }
  process.exit(1);
}
