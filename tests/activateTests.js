#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const activate = require(path.join(__dirname, "..", "src", "activate"));

let passed = 0;
let failed = 0;
const failures = [];

function t(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`  ✓ ${name}`);
    })
    .catch((err) => {
      failed++;
      failures.push({ name, message: err.message });
      console.log(`  ✗ ${name}`);
      console.log(`      ${err.message}`);
    });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}
function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(
      `${msg || "assertion failed"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}
function assertNotContains(haystack, needle, msg) {
  if (String(haystack).includes(needle)) {
    throw new Error(
      `${msg || "did not expect substring"}: ${JSON.stringify(needle)} found in ${JSON.stringify(haystack)}`
    );
  }
}

function makePrompt(answers) {
  let i = 0;
  return () => answers[i++];
}

function makeFetch({ ok = true, status = 200, statusText = "OK", body = {}, throws } = {}) {
  return async (url, opts) => {
    if (throws) throw new Error(throws);
    return {
      ok,
      status,
      statusText,
      json: async () => body
    };
  };
}

function tmpHome() {
  const dir = path.join(os.tmpdir(), `ts-activate-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function captureExit() {
  const orig = process.exit;
  let code = null;
  process.exit = (c) => { code = c; throw new Error(`__EXIT_${c}__`); };
  return {
    restore: () => { process.exit = orig; },
    code: () => code
  };
}

(async () => {
  console.log("\n[CLI] activate");

  await t("happy path: stores apiKey, file mode 0600, never prints key", async () => {
    const home = tmpHome();
    const captured = [];
    const errors = [];
    let fetchedUrl = null;
    let fetchedBody = null;

    await activate({
      prompt: makePrompt(["Steve Rouse", "steve@example.com"]),
      fetch: async (url, opts) => {
        fetchedUrl = url;
        fetchedBody = JSON.parse(opts.body);
        return {
          ok: true, status: 200, statusText: "OK",
          json: async () => ({
            name: "Steve Rouse",
            email: "steve@example.com",
            status: "trial",
            startedAt: "2026-05-07T00:00:00.000Z",
            trialDaysRemaining: 14,
            apiKey: "super-secret-key-do-not-print"
          })
        };
      },
      baseUrl: "https://api.test",
      homeDir: home,
      log: (m) => captured.push(String(m)),
      errLog: (m) => errors.push(String(m))
    });

    assertEqual(fetchedUrl, "https://api.test/activate");
    assertEqual(fetchedBody.name, "Steve Rouse");
    assertEqual(fetchedBody.email, "steve@example.com");

    const filePath = path.join(home, ".tokensmoker", "activation.json");
    assert(fs.existsSync(filePath), "activation.json should exist");
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    assertEqual(data.apiKey, "super-secret-key-do-not-print");
    assertEqual(data.email, "steve@example.com");
    assertEqual(data.status, "trial");
    assertEqual(data.trialDaysRemaining, 14);

    const stat = fs.statSync(filePath);
    const mode = stat.mode & 0o777;
    assertEqual(mode, 0o600, "file mode must be 0600");

    const stdout = captured.join("\n");
    const stderr = errors.join("\n");
    assertNotContains(stdout, "super-secret-key-do-not-print", "stdout must not include apiKey");
    assertNotContains(stderr, "super-secret-key-do-not-print", "stderr must not include apiKey");
    assertNotContains(stdout, "apiKey", "stdout must not mention apiKey field");

    fs.rmSync(home, { recursive: true, force: true });
  });

  await t("network error: prints failure, does not write file", async () => {
    const home = tmpHome();
    const exit = captureExit();
    const errors = [];
    try {
      await activate({
        prompt: makePrompt(["A", "a@a.com"]),
        fetch: makeFetch({ throws: "ECONNREFUSED" }),
        baseUrl: "https://api.test",
        homeDir: home,
        log: () => {},
        errLog: (m) => errors.push(String(m))
      });
    } catch (e) {
      if (!String(e.message).startsWith("__EXIT_")) throw e;
    } finally {
      exit.restore();
    }
    assertEqual(exit.code(), 1);
    assert(errors.join("\n").includes("ECONNREFUSED"));
    const filePath = path.join(home, ".tokensmoker", "activation.json");
    assert(!fs.existsSync(filePath), "no file written on network failure");
    fs.rmSync(home, { recursive: true, force: true });
  });

  await t("server 400 error: prints server message, no file written, no key leak", async () => {
    const home = tmpHome();
    const exit = captureExit();
    const errors = [];
    try {
      await activate({
        prompt: makePrompt(["A", "bad-email"]),
        fetch: makeFetch({
          ok: false, status: 400, statusText: "Bad Request",
          body: { error: "valid email is required" }
        }),
        baseUrl: "https://api.test",
        homeDir: home,
        log: () => {},
        errLog: (m) => errors.push(String(m))
      });
    } catch (e) {
      if (!String(e.message).startsWith("__EXIT_")) throw e;
    } finally {
      exit.restore();
    }
    assertEqual(exit.code(), 1);
    assert(errors.join("\n").includes("valid email is required"));
    const filePath = path.join(home, ".tokensmoker", "activation.json");
    assert(!fs.existsSync(filePath), "no file written on server error");
    assertNotContains(errors.join("\n"), "apiKey");
    fs.rmSync(home, { recursive: true, force: true });
  });

  await t("missing apiKey in response: fails cleanly", async () => {
    const home = tmpHome();
    const exit = captureExit();
    const errors = [];
    try {
      await activate({
        prompt: makePrompt(["A", "a@a.com"]),
        fetch: makeFetch({
          ok: true, status: 200,
          body: { name: "A", email: "a@a.com", status: "trial" }
        }),
        baseUrl: "https://api.test",
        homeDir: home,
        log: () => {},
        errLog: (m) => errors.push(String(m))
      });
    } catch (e) {
      if (!String(e.message).startsWith("__EXIT_")) throw e;
    } finally {
      exit.restore();
    }
    assertEqual(exit.code(), 1);
    assert(errors.join("\n").includes("did not return an API key"));
    fs.rmSync(home, { recursive: true, force: true });
  });

  await t("empty name: refuses without calling fetch", async () => {
    const home = tmpHome();
    const exit = captureExit();
    const errors = [];
    let fetchCalled = false;
    try {
      await activate({
        prompt: makePrompt(["", "a@a.com"]),
        fetch: async () => { fetchCalled = true; },
        baseUrl: "https://api.test",
        homeDir: home,
        log: () => {},
        errLog: (m) => errors.push(String(m))
      });
    } catch (e) {
      if (!String(e.message).startsWith("__EXIT_")) throw e;
    } finally {
      exit.restore();
    }
    assertEqual(exit.code(), 1);
    assertEqual(fetchCalled, false);
    fs.rmSync(home, { recursive: true, force: true });
  });

  await t("integration with credentials.resolveApiKey: stored key flows through", async () => {
    const home = tmpHome();
    await activate({
      prompt: makePrompt(["X", "x@x.com"]),
      fetch: async () => ({
        ok: true, status: 200, statusText: "OK",
        json: async () => ({
          name: "X", email: "x@x.com", status: "trial",
          startedAt: "2026-05-07T00:00:00.000Z",
          trialDaysRemaining: 14,
          apiKey: "flow-through-key"
        })
      }),
      baseUrl: "https://api.test",
      homeDir: home,
      log: () => {},
      errLog: () => {}
    });

    // Use credentials module the way compile does, but reading from our temp home.
    const filePath = path.join(home, ".tokensmoker", "activation.json");
    const stored = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const { resolveApiKey } = require(path.join(__dirname, "..", "src", "credentials"));
    const r = resolveApiKey({
      readEnv: () => undefined,
      readActivation: () => stored
    });
    assertEqual(r.apiKey, "flow-through-key");
    assertEqual(r.source, "activation");

    fs.rmSync(home, { recursive: true, force: true });
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.message}`);
    }
    process.exit(1);
  }
})();
