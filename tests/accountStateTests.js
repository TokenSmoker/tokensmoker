#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  refreshAccountState,
  readActivation,
  writeActivation,
  mergeFromServer
} = require(path.join(__dirname, "..", "src", "accountState"));

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
function assert(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }
function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(
      `${msg || "assertion failed"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function tmpHome() {
  const dir = path.join(
    os.tmpdir(),
    `ts-state-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

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
  console.log("\n[CLI] accountState.refreshAccountState");

  await t("paid response merges server-truth into local activation.json", async () => {
    const home = tmpHome();
    // Seed an existing local activation that says 'trial'.
    fs.mkdirSync(path.join(home, ".tokensmoker"), { recursive: true });
    const file = path.join(home, ".tokensmoker", "activation.json");
    fs.writeFileSync(file, JSON.stringify({
      name: "Eve",
      email: "eve@example.com",
      apiKey: "k_stored",
      status: "trial",
      activatedAt: "2026-05-01T00:00:00.000Z"
    }));

    let sentUrl = null;
    let sentHeaders = null;
    const r = await refreshAccountState({
      apiKey: "k_stored",
      baseUrl: "https://api.test",
      homeDir: home,
      fetchFn: async (url, opts) => {
        sentUrl = url;
        sentHeaders = opts.headers;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            email: "eve@example.com",
            plan: "starter",
            planName: "Starter Monthly",
            subscriptionStatus: "active",
            currentPeriodEnd: "2026-06-14T00:00:00.000Z",
            trialEndsAt: "2026-05-15T00:00:00.000Z",
            hasCustomer: true,
            paid: true,
            status: "commercial"
          })
        };
      }
    });

    assertEqual(sentUrl, "https://api.test/billing/me");
    assertEqual(sentHeaders.Authorization, "Bearer k_stored");
    assertEqual(r.ok, true);
    assertEqual(r.status, "paid");

    const stored = JSON.parse(fs.readFileSync(file, "utf8"));
    assertEqual(stored.name, "Eve", "existing name preserved");
    assertEqual(stored.apiKey, "k_stored", "existing apiKey preserved");
    assertEqual(stored.activatedAt, "2026-05-01T00:00:00.000Z",
      "original activatedAt preserved");
    assertEqual(stored.status, "commercial");
    assertEqual(stored.plan, "starter");
    assertEqual(stored.planName, "Starter Monthly");
    assertEqual(stored.subscriptionStatus, "active");
    assertEqual(stored.paid, true);
    assert(typeof stored.lastRefreshedAt === "string",
      "must stamp lastRefreshedAt");

    fs.rmSync(home, { recursive: true, force: true });
  });

  await t("trial response keeps status='trial' and updates trialEndsAt", async () => {
    const home = tmpHome();
    fs.mkdirSync(path.join(home, ".tokensmoker"), { recursive: true });
    const file = path.join(home, ".tokensmoker", "activation.json");
    fs.writeFileSync(file, JSON.stringify({
      apiKey: "k1", email: "x@y.com", status: "trial",
      activatedAt: new Date().toISOString()
    }));

    const r = await refreshAccountState({
      apiKey: "k1",
      baseUrl: "https://api.test",
      homeDir: home,
      fetchFn: makeFetch({
        status: 200,
        body: {
          email: "x@y.com",
          plan: "trial",
          planName: null,
          subscriptionStatus: null,
          currentPeriodEnd: null,
          trialEndsAt: "2026-05-21T00:00:00.000Z",
          hasCustomer: false,
          paid: false,
          status: "trial"
        }
      })
    });
    assertEqual(r.ok, true);
    assertEqual(r.status, "trial");
    const stored = JSON.parse(fs.readFileSync(file, "utf8"));
    assertEqual(stored.status, "trial");
    assertEqual(stored.trialEndsAt, "2026-05-21T00:00:00.000Z");
    fs.rmSync(home, { recursive: true, force: true });
  });

  await t("401 returns unauthorized; local file is NOT modified", async () => {
    const home = tmpHome();
    fs.mkdirSync(path.join(home, ".tokensmoker"), { recursive: true });
    const file = path.join(home, ".tokensmoker", "activation.json");
    const before = {
      apiKey: "k1", email: "x@y.com", status: "trial",
      activatedAt: "2026-05-01T00:00:00.000Z"
    };
    fs.writeFileSync(file, JSON.stringify(before));

    const r = await refreshAccountState({
      apiKey: "k1",
      baseUrl: "https://api.test",
      homeDir: home,
      fetchFn: makeFetch({ status: 401, body: { error: "Unauthorized" } })
    });
    assertEqual(r.ok, false);
    assertEqual(r.status, "unauthorized");
    const after = JSON.parse(fs.readFileSync(file, "utf8"));
    assertEqual(after.apiKey, before.apiKey, "file unchanged on 401");
    fs.rmSync(home, { recursive: true, force: true });
  });

  await t("network error returns unreachable; local file is NOT modified", async () => {
    const home = tmpHome();
    fs.mkdirSync(path.join(home, ".tokensmoker"), { recursive: true });
    const file = path.join(home, ".tokensmoker", "activation.json");
    fs.writeFileSync(file, JSON.stringify({
      apiKey: "k1", status: "trial", activatedAt: "2026-05-01T00:00:00.000Z"
    }));
    const r = await refreshAccountState({
      apiKey: "k1",
      baseUrl: "https://api.test",
      homeDir: home,
      fetchFn: makeFetch({ throws: "ECONNREFUSED" })
    });
    assertEqual(r.ok, false);
    assertEqual(r.status, "unreachable");
    fs.rmSync(home, { recursive: true, force: true });
  });

  await t("missing apiKey returns not_activated without calling fetch", async () => {
    let fetchCalled = false;
    const r = await refreshAccountState({
      apiKey: "",
      baseUrl: "https://api.test",
      fetchFn: async () => { fetchCalled = true; return {}; }
    });
    assertEqual(r.ok, false);
    assertEqual(r.status, "not_activated");
    assertEqual(fetchCalled, false);
  });

  console.log("\n[CLI] accountState.mergeFromServer");

  await t("merges payload onto existing without losing apiKey", () => {
    const merged = mergeFromServer(
      { apiKey: "k1", name: "Eve", activatedAt: "T0" },
      {
        email: "eve@x.com",
        plan: "starter",
        planName: "Starter Monthly",
        subscriptionStatus: "active",
        currentPeriodEnd: "2026-06-01T00:00:00.000Z",
        trialEndsAt: null,
        hasCustomer: true,
        paid: true,
        status: "commercial"
      }
    );
    assertEqual(merged.apiKey, "k1");
    assertEqual(merged.activatedAt, "T0");
    assertEqual(merged.name, "Eve");
    assertEqual(merged.status, "commercial");
    assertEqual(merged.paid, true);
    assertEqual(merged.planName, "Starter Monthly");
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
