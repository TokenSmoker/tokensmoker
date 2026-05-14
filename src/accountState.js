const fs = require("fs");
const path = require("path");
const os = require("os");

const DEFAULT_API_URL = "https://tokensmoker-api.onrender.com";
const ACTIVATION_FILE = "activation.json";

function activationPaths(homeDir) {
  const dir = path.join(homeDir || os.homedir(), ".tokensmoker");
  return { dir, file: path.join(dir, ACTIVATION_FILE) };
}

function readActivation(homeDir) {
  const { file } = activationPaths(homeDir);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeActivation(data, homeDir) {
  const { dir, file } = activationPaths(homeDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // best-effort on platforms that don't honor mode in writeFileSync
  }
}

// Merge a /billing/me payload into the cached activation.json.
// The apiKey and activatedAt are preserved from the existing file;
// everything else takes its value from the server, which is canonical.
function mergeFromServer(existing, payload) {
  const e = existing || {};
  const p = payload || {};
  const status = p.paid ? "commercial" : "trial";
  return {
    name: e.name || p.email || null,
    email: p.email || e.email,
    apiKey: e.apiKey,
    status,
    licenseStatus: p.subscriptionStatus || e.licenseStatus || undefined,
    plan: p.plan || null,
    planName: p.planName || null,
    subscriptionStatus: p.subscriptionStatus || null,
    currentPeriodEnd: p.currentPeriodEnd || null,
    trialEndsAt: p.trialEndsAt || null,
    hasCustomer: !!p.hasCustomer,
    paid: !!p.paid,
    activatedAt: e.activatedAt || new Date().toISOString(),
    lastRefreshedAt: new Date().toISOString()
  };
}

// Refresh local activation against GET /billing/me.
// Returns:
//   { ok: true,  status: 'paid'|'trial', data, merged } — server-truth applied
//   { ok: false, status: 'not_activated' }              — no key supplied
//   { ok: false, status: 'unauthorized' }               — 401/403 from API
//   { ok: false, status: 'unreachable' }                — network / 5xx / bad JSON
async function refreshAccountState({
  apiKey,
  baseUrl,
  homeDir,
  fetchFn
} = {}) {
  if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
    return { ok: false, status: "not_activated" };
  }
  const f = fetchFn || globalThis.fetch;
  const url =
    (baseUrl || process.env.TOKENSMOKER_API_URL || DEFAULT_API_URL) +
    "/billing/me";

  let res;
  try {
    res = await f(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` }
    });
  } catch (_err) {
    return { ok: false, status: "unreachable" };
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, status: "unauthorized" };
  }
  if (!res.ok) {
    return { ok: false, status: "unreachable" };
  }
  let payload;
  try {
    payload = await res.json();
  } catch {
    return { ok: false, status: "unreachable" };
  }

  const existing = readActivation(homeDir);
  let merged = null;
  if (existing && existing.apiKey) {
    merged = mergeFromServer(existing, payload);
    writeActivation(merged, homeDir);
  }
  return {
    ok: true,
    status: payload.paid ? "paid" : "trial",
    data: payload,
    merged
  };
}

module.exports = {
  refreshAccountState,
  readActivation,
  writeActivation,
  mergeFromServer,
  activationPaths,
  DEFAULT_API_URL
};
