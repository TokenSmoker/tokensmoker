#!/usr/bin/env node
"use strict";

const path = require("path");
const upgrade = require(path.join(__dirname, "..", "src", "upgrade"));
const {
  NOT_ACTIVATED_MESSAGE,
  INVALID_ACTIVATION_MESSAGE
} = require(path.join(__dirname, "..", "src", "upgrade"));

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

async function runUpgrade(args, deps) {
  const exit = captureExit();
  try {
    await upgrade(args, deps);
  } catch (e) {
    if (!String(e.message).startsWith("__EXIT_")) throw e;
  } finally {
    exit.restore();
  }
  return exit.code();
}

const SECRET_KEY = "super-secret-key-xyz-do-not-print";
const CHECKOUT_URL = "https://checkout.stripe.com/c/pay/cs_test_abc123";

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
  console.log("\n[CLI] upgrade");

  await t("happy path: POSTs /billing/checkout with Bearer, prints url, opens browser", async () => {
    const log = [];
    const err = [];
    let sentUrl = null;
    let sentHeaders = null;
    let sentBody = null;
    let openedWith = null;

    const code = await runUpgrade([], {
      resolveApiKey: activated(),
      fetch: async (url, opts) => {
        sentUrl = url;
        sentHeaders = opts.headers;
        sentBody = opts.body;
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({ url: CHECKOUT_URL })
        };
      },
      openBrowser: (u) => { openedWith = u; return true; },
      baseUrl: "https://api.test",
      log: (m) => log.push(String(m)),
      errLog: (m) => err.push(String(m))
    });

    assertEqual(code, null, "must not exit on success");
    assertEqual(sentUrl, "https://api.test/billing/checkout");
    assertEqual(sentHeaders.Authorization, `Bearer ${SECRET_KEY}`,
      "must send Bearer auth header");
    assertEqual(sentHeaders["Content-Type"], "application/json");
    assertEqual(sentBody, "{}", "body must be empty JSON object");
    assertEqual(openedWith, CHECKOUT_URL, "must attempt to open checkout url");

    const out = log.join("\n");
    assert(out.includes("Opening Stripe Checkout..."),
      "must print opening message when browser open succeeds");
    assert(out.includes("If your browser did not open, paste this URL:"),
      "must always print fallback line");
    assert(out.includes(CHECKOUT_URL),
      "must print the actual url for copy-paste fallback");

    // No secret leakage anywhere.
    const combined = out + "\n" + err.join("\n");
    assertNotContains(combined, SECRET_KEY, "API key must never appear in output");
    assertNotContains(combined, "Bearer ", "Authorization header must not be echoed");
    assertNotContains(combined, "Authorization", "Header name must not appear");
  });

  await t("browser open failure: still prints fallback URL, no 'Opening...' line", async () => {
    const log = [];
    const code = await runUpgrade([], {
      resolveApiKey: activated(),
      fetch: makeFetch({ status: 200, body: { url: CHECKOUT_URL } }),
      openBrowser: () => false,
      log: (m) => log.push(String(m)),
      errLog: () => {}
    });
    assertEqual(code, null);
    const out = log.join("\n");
    assertNotContains(out, "Opening Stripe Checkout...",
      "must NOT print 'Opening...' when browser open returns false");
    assert(out.includes("If your browser did not open, paste this URL:"));
    assert(out.includes(CHECKOUT_URL));
  });

  await t("missing activation → activate-by-email guidance, exit 1, no fetch", async () => {
    let fetchCalled = false;
    const err = [];
    const code = await runUpgrade([], {
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
    const code = await runUpgrade([], {
      resolveApiKey: activated(),
      fetch: makeFetch({ status: 401, body: { error: "Unauthorized" } }),
      openBrowser: () => true,
      log: () => {},
      errLog: (m) => err.push(String(m))
    });
    assertEqual(code, 1);
    assertEqual(err.join("\n"), INVALID_ACTIVATION_MESSAGE);
  });

  await t("403 from API → reactivation guidance and exit 1", async () => {
    const err = [];
    const code = await runUpgrade([], {
      resolveApiKey: activated(),
      fetch: makeFetch({
        status: 403,
        body: { error: "Free trial expired. Run tokensmoker upgrade to subscribe." }
      }),
      openBrowser: () => true,
      log: () => {},
      errLog: (m) => err.push(String(m))
    });
    assertEqual(code, 1);
    assertEqual(err.join("\n"), INVALID_ACTIVATION_MESSAGE);
  });

  await t("404 from API → 'TokenSmoker account was not found.' and exit 1", async () => {
    const err = [];
    const code = await runUpgrade([], {
      resolveApiKey: activated(),
      fetch: makeFetch({ status: 404, body: { error: "API key not found" } }),
      openBrowser: () => true,
      log: () => {},
      errLog: (m) => err.push(String(m))
    });
    assertEqual(code, 1);
    assert(err.join("\n").includes("TokenSmoker account was not found."));
  });

  await t("network error → sanitized billing message, no raw error leaked", async () => {
    const err = [];
    const code = await runUpgrade([], {
      resolveApiKey: activated(),
      fetch: makeFetch({
        throws: `ECONNREFUSED 1.2.3.4:443 ${SECRET_KEY}`
      }),
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

  await t("5xx from API → sanitized billing message", async () => {
    const err = [];
    const code = await runUpgrade([], {
      resolveApiKey: activated(),
      fetch: makeFetch({ status: 502, body: { error: "Billing provider error" } }),
      openBrowser: () => true,
      log: () => {},
      errLog: (m) => err.push(String(m))
    });
    assertEqual(code, 1);
    assert(err.join("\n").includes("Unable to contact TokenSmoker billing service."));
  });

  await t("invalid JSON response → sanitized billing message", async () => {
    const err = [];
    const code = await runUpgrade([], {
      resolveApiKey: activated(),
      fetch: async () => ({
        ok: true,
        status: 200,
        json: async () => { throw new Error("not JSON"); }
      }),
      openBrowser: () => true,
      log: () => {},
      errLog: (m) => err.push(String(m))
    });
    assertEqual(code, 1);
    assert(err.join("\n").includes("Unable to contact TokenSmoker billing service."));
  });

  await t("missing url field → 'Billing service did not return a checkout URL.' exit 1", async () => {
    const err = [];
    const code = await runUpgrade([], {
      resolveApiKey: activated(),
      fetch: makeFetch({ status: 200, body: {} }),
      openBrowser: () => true,
      log: () => {},
      errLog: (m) => err.push(String(m))
    });
    assertEqual(code, 1);
    assert(err.join("\n").includes("Billing service did not return a checkout URL."));
  });

  await t("empty url string also rejected", async () => {
    const err = [];
    const code = await runUpgrade([], {
      resolveApiKey: activated(),
      fetch: makeFetch({ status: 200, body: { url: "" } }),
      openBrowser: () => true,
      log: () => {},
      errLog: (m) => err.push(String(m))
    });
    assertEqual(code, 1);
    assert(err.join("\n").includes("Billing service did not return a checkout URL."));
  });

  await t("secret never appears in stdout/stderr across all branches", async () => {
    for (const [label, fetchImpl] of [
      ["happy", makeFetch({ status: 200, body: { url: CHECKOUT_URL } })],
      ["401", makeFetch({ status: 401, body: { error: SECRET_KEY } })],
      ["403", makeFetch({ status: 403, body: { error: SECRET_KEY } })],
      ["404", makeFetch({ status: 404, body: { error: SECRET_KEY } })],
      ["500", makeFetch({ status: 500, body: { error: SECRET_KEY } })],
      ["throw", makeFetch({ throws: SECRET_KEY })],
      ["no-url", makeFetch({ status: 200, body: {} })]
    ]) {
      const out = [];
      const err = [];
      await runUpgrade([], {
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

  await t("alreadyUpgraded response: prints status, does NOT open browser", async () => {
    const log = [];
    const err = [];
    let openCalled = false;

    const code = await runUpgrade([], {
      resolveApiKey: activated(),
      fetch: makeFetch({
        status: 200,
        body: {
          alreadyUpgraded: true,
          plan: "starter",
          planName: "Starter Monthly",
          subscriptionStatus: "active",
          manageUrl: "https://billing.stripe.com/p/session/abc"
        }
      }),
      openBrowser: () => { openCalled = true; return true; },
      log: (m) => log.push(String(m)),
      errLog: (m) => err.push(String(m))
    });

    assertEqual(code, null, "exit code must be 0 (no process.exit)");
    assertEqual(openCalled, false,
      "must NOT open browser when already upgraded — guards against double-charge");
    const out = log.join("\n");
    assert(out.includes("TokenSmoker is already upgraded."));
    assert(out.includes("Plan: Starter Monthly"));
    assert(out.includes("Status: active"));
    assert(out.includes("https://billing.stripe.com/p/session/abc"),
      "must show manageUrl when API provides one");
    // Crucially: never tells the user to rerun `smoke activate`.
    assertNotContains(out, "smoke activate");
  });

  await t("alreadyUpgraded without manageUrl falls back to 'smoke cancel' hint", async () => {
    const log = [];
    let openCalled = false;
    const code = await runUpgrade([], {
      resolveApiKey: activated(),
      fetch: makeFetch({
        status: 200,
        body: {
          alreadyUpgraded: true,
          plan: "starter",
          planName: null,
          subscriptionStatus: "active",
          manageUrl: null
        }
      }),
      openBrowser: () => { openCalled = true; return true; },
      log: (m) => log.push(String(m)),
      errLog: () => {}
    });
    assertEqual(code, null);
    assertEqual(openCalled, false);
    const out = log.join("\n");
    assert(out.includes("TokenSmoker is already upgraded."));
    assert(out.includes("Plan: starter"),
      "falls back to plan when planName missing");
    assert(out.includes("smoke cancel"),
      "must hint at smoke cancel when manageUrl missing");
  });

  await t("successful checkout prints 'smoke status' guidance, not 'smoke activate'", async () => {
    const log = [];
    await runUpgrade([], {
      resolveApiKey: activated(),
      fetch: makeFetch({ status: 200, body: { url: CHECKOUT_URL } }),
      openBrowser: () => true,
      log: (m) => log.push(String(m)),
      errLog: () => {}
    });
    const out = log.join("\n");
    assert(out.includes("After completing checkout, run:"),
      "must tell user the next step after checkout");
    assert(out.includes("smoke status"),
      "next step is `smoke status`, not `smoke activate`");
    assert(out.includes("refresh automatically"),
      "must reassure user the local activation refreshes automatically");
    assertNotContains(out, "smoke activate",
      "must NOT tell user to rerun activate after payment");
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
