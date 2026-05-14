#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const activate = require(path.join(__dirname, "..", "src", "activate"));
const {
  parseActivateArgs,
  LEGACY_MESSAGE
} = require(path.join(__dirname, "..", "src", "activate"));

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

function tmpHome() {
  const dir = path.join(
    os.tmpdir(),
    `ts-activate-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function captureExit() {
  const orig = process.exit;
  let code = null;
  process.exit = (c) => {
    code = c;
    throw new Error(`__EXIT_${c}__`);
  };
  return {
    restore: () => {
      process.exit = orig;
    },
    code: () => code
  };
}

async function runActivate(args, deps) {
  const exit = captureExit();
  try {
    await activate(args, deps);
  } catch (e) {
    if (!String(e.message).startsWith("__EXIT_")) throw e;
  } finally {
    exit.restore();
  }
  return exit.code();
}

const SECRET_KEY = "super-secret-key-do-not-print-abc123";

function makeFetch({ status = 200, body, throws } = {}) {
  return async (_url, _opts) => {
    if (throws) throw new Error(throws);
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: String(status),
      json: async () => body
    };
  };
}

(async () => {
  // ────────────────────────────────────────────────────────────────────
  console.log("\n[CLI] parseActivateArgs");

  await t("parses --email flag", () => {
    const r = parseActivateArgs(["--email", "a@b.com"]);
    assertEqual(r.email, "a@b.com");
    assertEqual(r.legacyToken, false);
  });

  await t("parses --email=value form", () => {
    const r = parseActivateArgs(["--email=a@b.com"]);
    assertEqual(r.email, "a@b.com");
  });

  await t("parses -e shorthand", () => {
    const r = parseActivateArgs(["-e", "a@b.com"]);
    assertEqual(r.email, "a@b.com");
  });

  await t("accepts bare email-shaped positional", () => {
    const r = parseActivateArgs(["a@b.com"]);
    assertEqual(r.email, "a@b.com");
    assertEqual(r.legacyToken, false);
  });

  await t("flags non-email positional as legacy token", () => {
    const r = parseActivateArgs(["abc123secretkey"]);
    assertEqual(r.email, null);
    assertEqual(r.legacyToken, true);
  });

  // ────────────────────────────────────────────────────────────────────
  console.log("\n[CLI] activate --email");

  await t("happy path: writes apiKey to activation.json, never prints it", async () => {
    const home = tmpHome();
    const log = [];
    const err = [];
    let sentUrl = null;
    let sentBody = null;

    const code = await runActivate(["--email", "eve@example.com"], {
      fetch: async (url, opts) => {
        sentUrl = url;
        sentBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            apiKey: SECRET_KEY,
            email: "eve@example.com",
            plan: "starter",
            subscriptionStatus: "active",
            trialEndsAt: "2026-05-28T00:00:00.000Z"
          })
        };
      },
      baseUrl: "https://api.test",
      homeDir: home,
      log: (m) => log.push(String(m)),
      errLog: (m) => err.push(String(m))
    });

    assertEqual(code, null, "should not exit on success");
    assertEqual(sentUrl, "https://api.test/activate/lookup");
    assertEqual(sentBody.email, "eve@example.com");
    assert(!("name" in sentBody), "lookup request must not include name");

    const filePath = path.join(home, ".tokensmoker", "activation.json");
    assert(fs.existsSync(filePath), "activation.json should exist");
    const stored = JSON.parse(fs.readFileSync(filePath, "utf8"));
    assertEqual(stored.apiKey, SECRET_KEY);
    assertEqual(stored.email, "eve@example.com");
    assertEqual(stored.plan, "starter");
    assertEqual(stored.subscriptionStatus, "active");
    assertEqual(stored.status, "commercial");

    const mode = fs.statSync(filePath).mode & 0o777;
    assertEqual(mode, 0o600, "file mode must be 0600");

    const all = log.join("\n") + "\n" + err.join("\n");
    assertNotContains(all, SECRET_KEY, "API key must never be printed");
    assertNotContains(all, "apiKey", "stdout must not mention apiKey field");
    assert(all.includes("TokenSmoker activated for eve@example.com."),
      "must print activation confirmation");
    assert(log.join("\n").includes("Plan: starter"),
      "should print plan info");
    assert(log.join("\n").includes("Subscription: active"),
      "should print subscription info");

    fs.rmSync(home, { recursive: true, force: true });
  });

  await t("happy path (trial only): no Subscription line printed", async () => {
    const home = tmpHome();
    const log = [];
    const err = [];
    const code = await runActivate(["--email", "eve@example.com"], {
      fetch: makeFetch({
        status: 200,
        body: {
          apiKey: SECRET_KEY,
          email: "eve@example.com",
          plan: null,
          subscriptionStatus: null,
          trialEndsAt: "2026-05-21T00:00:00.000Z"
        }
      }),
      baseUrl: "https://api.test",
      homeDir: home,
      log: (m) => log.push(String(m)),
      errLog: (m) => err.push(String(m))
    });
    assertEqual(code, null);
    const out = log.join("\n");
    assert(out.includes("TokenSmoker activated for eve@example.com."));
    assertNotContains(out, "Plan:");
    assertNotContains(out, "Subscription:");
    assertNotContains(out + err.join("\n"), SECRET_KEY);
    fs.rmSync(home, { recursive: true, force: true });
  });

  await t("invalid email → 'Please provide a valid email address.' and exit 1", async () => {
    const home = tmpHome();
    let fetchCalled = false;
    const err = [];
    const code = await runActivate(["--email", "not-an-email"], {
      fetch: async () => {
        fetchCalled = true;
        return { ok: true, status: 200, json: async () => ({}) };
      },
      baseUrl: "https://api.test",
      homeDir: home,
      log: () => {},
      errLog: (m) => err.push(String(m))
    });
    assertEqual(code, 1);
    assertEqual(fetchCalled, false, "should not call API for invalid email");
    assert(err.join("\n").includes("Please provide a valid email address."));
    fs.rmSync(home, { recursive: true, force: true });
  });

  await t("missing --email and non-TTY → invalid email message", async () => {
    const home = tmpHome();
    const err = [];
    const code = await runActivate([], {
      fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
      baseUrl: "https://api.test",
      homeDir: home,
      isTTY: false,
      log: () => {},
      errLog: (m) => err.push(String(m))
    });
    assertEqual(code, 1);
    assert(err.join("\n").includes("Please provide a valid email address."));
    fs.rmSync(home, { recursive: true, force: true });
  });

  await t("404 from API → 'No TokenSmoker account found for ...' and exit 1", async () => {
    const home = tmpHome();
    const err = [];
    const code = await runActivate(["--email", "ghost@example.com"], {
      fetch: makeFetch({
        status: 404,
        body: { error: "No account found for this email." }
      }),
      baseUrl: "https://api.test",
      homeDir: home,
      log: () => {},
      errLog: (m) => err.push(String(m))
    });
    assertEqual(code, 1);
    assert(err.join("\n").includes("No TokenSmoker account found for ghost@example.com."),
      "must print 404 message with email interpolated");
    const filePath = path.join(home, ".tokensmoker", "activation.json");
    assert(!fs.existsSync(filePath), "no file written on 404");
    fs.rmSync(home, { recursive: true, force: true });
  });

  await t("403 from API → exact unsubscribed message and exit 1", async () => {
    const home = tmpHome();
    const err = [];
    const code = await runActivate(["--email", "expired@example.com"], {
      fetch: makeFetch({
        status: 403,
        body: { error: "No active trial or subscription found for this email." }
      }),
      baseUrl: "https://api.test",
      homeDir: home,
      log: () => {},
      errLog: (m) => err.push(String(m))
    });
    assertEqual(code, 1);
    assert(err.join("\n").includes("No active trial or subscription found for this email."));
    const filePath = path.join(home, ".tokensmoker", "activation.json");
    assert(!fs.existsSync(filePath), "no file written on 403");
    fs.rmSync(home, { recursive: true, force: true });
  });

  await t("network failure → 'Unable to contact TokenSmoker activation service.' and exit 1", async () => {
    const home = tmpHome();
    const err = [];
    const code = await runActivate(["--email", "eve@example.com"], {
      fetch: makeFetch({ throws: "ECONNREFUSED 1.2.3.4:443 super-secret-key" }),
      baseUrl: "https://api.test",
      homeDir: home,
      log: () => {},
      errLog: (m) => err.push(String(m))
    });
    assertEqual(code, 1);
    const out = err.join("\n");
    assertEqual(out.trim(), "Unable to contact TokenSmoker activation service.",
      "must print exact, sanitized network-failure message");
    // Underlying error must NOT leak through (could contain auth or addr details).
    assertNotContains(out, "ECONNREFUSED");
    assertNotContains(out, "super-secret-key");
    fs.rmSync(home, { recursive: true, force: true });
  });

  await t("5xx from API → same sanitized failure message", async () => {
    const home = tmpHome();
    const err = [];
    const code = await runActivate(["--email", "eve@example.com"], {
      fetch: makeFetch({ status: 500, body: { error: "internal" } }),
      baseUrl: "https://api.test",
      homeDir: home,
      log: () => {},
      errLog: (m) => err.push(String(m))
    });
    assertEqual(code, 1);
    assert(err.join("\n").includes("Unable to contact TokenSmoker activation service."));
    fs.rmSync(home, { recursive: true, force: true });
  });

  await t("legacy raw-token form → deprecation message and exit 1", async () => {
    const home = tmpHome();
    let fetchCalled = false;
    const err = [];
    const code = await runActivate(["abc123notanemailtoken"], {
      fetch: async () => {
        fetchCalled = true;
        return { ok: true, status: 200, json: async () => ({}) };
      },
      baseUrl: "https://api.test",
      homeDir: home,
      log: () => {},
      errLog: (m) => err.push(String(m))
    });
    assertEqual(code, 1);
    assertEqual(fetchCalled, false);
    const out = err.join("\n");
    assert(out.includes("Manual API key activation is no longer supported."),
      "must show legacy deprecation header");
    assert(out.includes("--email you@example.com"),
      "must point users at the new form");
    assertEqual(out, LEGACY_MESSAGE);
    fs.rmSync(home, { recursive: true, force: true });
  });

  await t("integration with credentials.resolveApiKey: stored key flows through", async () => {
    const home = tmpHome();
    await runActivate(["--email", "eve@example.com"], {
      fetch: makeFetch({
        status: 200,
        body: {
          apiKey: "flow-through-key",
          email: "eve@example.com",
          plan: "starter",
          subscriptionStatus: "active",
          trialEndsAt: null
        }
      }),
      baseUrl: "https://api.test",
      homeDir: home,
      log: () => {},
      errLog: () => {}
    });
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

  await t("re-activation preserves existing 'name' from prior activation.json", async () => {
    const home = tmpHome();
    const dir = path.join(home, ".tokensmoker");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "activation.json"),
      JSON.stringify({
        name: "Original Steve",
        email: "eve@example.com",
        apiKey: "old-key",
        status: "trial",
        activatedAt: "2026-05-01T00:00:00.000Z"
      })
    );
    await runActivate(["--email", "eve@example.com"], {
      fetch: makeFetch({
        status: 200,
        body: {
          apiKey: "new-key",
          email: "eve@example.com",
          plan: "starter",
          subscriptionStatus: "active",
          trialEndsAt: null
        }
      }),
      baseUrl: "https://api.test",
      homeDir: home,
      log: () => {},
      errLog: () => {}
    });
    const filePath = path.join(home, ".tokensmoker", "activation.json");
    const stored = JSON.parse(fs.readFileSync(filePath, "utf8"));
    assertEqual(stored.name, "Original Steve", "existing name preserved");
    assertEqual(stored.apiKey, "new-key", "apiKey rotated");
    fs.rmSync(home, { recursive: true, force: true });
  });

  await t("no Authorization header is sent on /activate/lookup", async () => {
    const home = tmpHome();
    let sentHeaders = null;
    await runActivate(["--email", "eve@example.com"], {
      fetch: async (_url, opts) => {
        sentHeaders = opts.headers || {};
        return {
          ok: true,
          status: 200,
          json: async () => ({
            apiKey: SECRET_KEY, email: "eve@example.com",
            plan: "starter", subscriptionStatus: "active", trialEndsAt: null
          })
        };
      },
      baseUrl: "https://api.test",
      homeDir: home,
      log: () => {},
      errLog: () => {}
    });
    const headerNames = Object.keys(sentHeaders).map((h) => h.toLowerCase());
    assert(!headerNames.includes("authorization"),
      "must not attach Authorization header — endpoint is keyless");
    fs.rmSync(home, { recursive: true, force: true });
  });

  await t("raw key absent from all stderr branches (404, 403, 5xx, network)", async () => {
    const home = tmpHome();
    for (const [label, fetchImpl] of [
      ["404", makeFetch({ status: 404, body: { error: "x" } })],
      ["403", makeFetch({ status: 403, body: { error: "x" } })],
      ["500", makeFetch({ status: 500, body: { error: "x" } })],
      ["throw", makeFetch({ throws: SECRET_KEY })]
    ]) {
      const out = [];
      const err = [];
      await runActivate(["--email", "eve@example.com"], {
        fetch: fetchImpl,
        baseUrl: "https://api.test",
        homeDir: home,
        log: (m) => out.push(String(m)),
        errLog: (m) => err.push(String(m))
      });
      const combined = out.join("\n") + "\n" + err.join("\n");
      assertNotContains(combined, SECRET_KEY,
        `secret leaked in ${label} branch`);
    }
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
