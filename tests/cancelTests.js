#!/usr/bin/env node
"use strict";

const path = require("path");
const cancel = require(path.join(__dirname, "..", "src", "cancel"));
const {
  NOT_ACTIVATED_MESSAGE,
  INVALID_ACTIVATION_MESSAGE,
  NO_SUBSCRIPTION_MESSAGE
} = require(path.join(__dirname, "..", "src", "cancel"));

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

function captureExit() {
  const orig = process.exit;
  let code = null;
  process.exit = (c) => {
    code = c;
    throw new Error(`__EXIT_${c}__`);
  };
  return {
    restore: () => { process.exit = orig; },
    code: () => code
  };
}

async function runCancel(args, deps) {
  const exit = captureExit();
  try {
    await cancel(args, deps);
  } catch (e) {
    if (!String(e.message).startsWith("__EXIT_")) throw e;
  } finally {
    exit.restore();
  }
  return exit.code();
}

const SECRET_KEY = "super-secret-cancel-key-xyz";
const PORTAL_URL = "https://billing.stripe.com/p/session/test123";

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

function activated(apiKey = SECRET_KEY) {
  return () => ({ apiKey, source: "activation" });
}

function notActivated() {
  return () => ({
    apiKey: null,
    source: null,
    error: "TokenSmoker is not activated."
  });
}

(async () => {
  console.log("\n[CLI] cancel");

  await t("happy path: POSTs /billing/portal with Bearer, opens portal URL", async () => {
    const log = [];
    const err = [];
    let sentUrl = null;
    let sentHeaders = null;
    let sentBody = null;
    let openedWith = null;

    const code = await runCancel([], {
      resolveApiKey: activated(),
      fetch: async (url, opts) => {
        sentUrl = url;
        sentHeaders = opts.headers;
        sentBody = opts.body;
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({ url: PORTAL_URL })
        };
      },
      openBrowser: (u) => { openedWith = u; return true; },
      baseUrl: "https://api.test",
      log: (m) => log.push(String(m)),
      errLog: (m) => err.push(String(m))
    });

    assertEqual(code, null, "must not exit on success");
    assertEqual(sentUrl, "https://api.test/billing/portal");
    assertEqual(sentHeaders.Authorization, `Bearer ${SECRET_KEY}`);
    assertEqual(sentHeaders["Content-Type"], "application/json");
    assertEqual(sentBody, "{}");
    assertEqual(openedWith, PORTAL_URL);

    const out = log.join("\n");
    assert(out.includes("Opening billing management page..."));
    assert(out.includes("If your browser did not open, paste this URL:"));
    assert(out.includes(PORTAL_URL));

    const combined = out + "\n" + err.join("\n");
    assertNotContains(combined, SECRET_KEY, "API key must never appear in output");
    assertNotContains(combined, "Bearer ", "Authorization header must not be echoed");
  });

  await t("missing activation → activate-by-email guidance, exit 1, no fetch", async () => {
    let fetchCalled = false;
    const err = [];
    const code = await runCancel([], {
      resolveApiKey: notActivated(),
      fetch: async () => {
        fetchCalled = true;
        return { ok: true, status: 200, json: async () => ({}) };
      },
      openBrowser: () => true,
      log: () => {},
      errLog: (m) => err.push(String(m))
    });
    assertEqual(code, 1);
    assertEqual(fetchCalled, false);
    assertEqual(err.join("\n"), NOT_ACTIVATED_MESSAGE);
    assert(err.join("\n").includes("smoke activate --email you@example.com"));
  });

  await t("401 from API → reactivation guidance and exit 1", async () => {
    const err = [];
    const code = await runCancel([], {
      resolveApiKey: activated(),
      fetch: makeFetch({ status: 401, body: { error: "Unauthorized" } }),
      openBrowser: () => true,
      log: () => {},
      errLog: (m) => err.push(String(m))
    });
    assertEqual(code, 1);
    assertEqual(err.join("\n"), INVALID_ACTIVATION_MESSAGE);
  });

  await t("409 from API (no paid subscription) → no-subscription guidance and exit 1", async () => {
    const err = [];
    const code = await runCancel([], {
      resolveApiKey: activated(),
      fetch: makeFetch({ status: 409, body: { error: "No paid subscription to manage." } }),
      openBrowser: () => true,
      log: () => {},
      errLog: (m) => err.push(String(m))
    });
    assertEqual(code, 1);
    assert(err.join("\n").includes(NO_SUBSCRIPTION_MESSAGE));
    assert(err.join("\n").includes("smoke upgrade"));
  });

  await t("network error → sanitized billing message", async () => {
    const err = [];
    const code = await runCancel([], {
      resolveApiKey: activated(),
      fetch: makeFetch({ throws: `ECONNREFUSED 1.2.3.4:443 ${SECRET_KEY}` }),
      openBrowser: () => true,
      log: () => {},
      errLog: (m) => err.push(String(m))
    });
    assertEqual(code, 1);
    const out = err.join("\n");
    assertEqual(out.trim(), "Unable to contact TokenSmoker billing service.");
    assertNotContains(out, "ECONNREFUSED");
    assertNotContains(out, SECRET_KEY);
  });

  await t("missing url field → 'Billing service did not return a portal URL.' exit 1", async () => {
    const err = [];
    const code = await runCancel([], {
      resolveApiKey: activated(),
      fetch: makeFetch({ status: 200, body: {} }),
      openBrowser: () => true,
      log: () => {},
      errLog: (m) => err.push(String(m))
    });
    assertEqual(code, 1);
    assert(err.join("\n").includes("Billing service did not return a portal URL."));
  });

  await t("secret never appears in stdout/stderr across all branches", async () => {
    for (const [label, fetchImpl] of [
      ["happy", makeFetch({ status: 200, body: { url: PORTAL_URL } })],
      ["401", makeFetch({ status: 401, body: { error: SECRET_KEY } })],
      ["409", makeFetch({ status: 409, body: { error: SECRET_KEY } })],
      ["404", makeFetch({ status: 404, body: { error: SECRET_KEY } })],
      ["500", makeFetch({ status: 500, body: { error: SECRET_KEY } })],
      ["throw", makeFetch({ throws: SECRET_KEY })],
      ["no-url", makeFetch({ status: 200, body: {} })]
    ]) {
      const out = [];
      const err = [];
      await runCancel([], {
        resolveApiKey: activated(),
        fetch: fetchImpl,
        openBrowser: () => true,
        log: (m) => out.push(String(m)),
        errLog: (m) => err.push(String(m))
      });
      const combined = out.join("\n") + "\n" + err.join("\n");
      assertNotContains(combined, SECRET_KEY,
        `API key leaked in '${label}' branch`);
      assertNotContains(combined, "Bearer ",
        `Bearer header leaked in '${label}' branch`);
    }
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
