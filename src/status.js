const fs = require("fs");
const path = require("path");
const os = require("os");
const { refreshAccountState, readActivation } = require("./accountState");

const TRIAL_DAYS = 14;
const QUIET_DAYS = 10;

// Legacy export — `credentials.js` (and tests that exercise it) consume
// this. Keep it stable.
function getActivationData() {
  const filePath = path.join(os.homedir(), ".tokensmoker", "activation.json");
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath));
}

function getTrialInfo(data) {
  const activatedAt = new Date(data.activatedAt);
  const now = new Date();

  const daysUsed = Math.floor(
    (now - activatedAt) / (1000 * 60 * 60 * 24)
  );

  const daysRemaining = Math.max(TRIAL_DAYS - daysUsed, 0);
  const expired = data.status === "trial" && daysUsed >= TRIAL_DAYS;
  const shouldWarn = data.status === "trial" && daysUsed >= QUIET_DAYS;

  return {
    daysUsed,
    daysRemaining,
    expired,
    shouldWarn
  };
}

function formatDateOnly(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

async function status(deps = {}) {
  const log = deps.log || console.log;
  const fetchFn = deps.fetch || globalThis.fetch;
  const baseUrl = deps.baseUrl;
  const homeDir = deps.homeDir;

  let data = deps.readActivation
    ? deps.readActivation()
    : readActivation(homeDir);

  if (!data) {
    log("TokenSmoker not activated.");
    log("Run: smoke activate --email you@example.com");
    return;
  }

  // Refresh from server first so post-payment state shows up without
  // requiring the user to re-run `smoke activate`. Falls back to the
  // local cache on network failure or unauthorized.
  const refresh = await refreshAccountState({
    apiKey: data.apiKey,
    baseUrl,
    homeDir,
    fetchFn
  });

  let unreachable = false;
  if (refresh.ok) {
    // Re-read so we display the merged file (or use the merged object).
    data = refresh.merged || data;
  } else if (refresh.status === "unauthorized") {
    log("TokenSmoker activation needs to be refreshed.");
    log("Run: smoke activate --email you@example.com");
    return;
  } else {
    // unreachable — fall back to local cache, but flag it.
    unreachable = true;
  }

  log("TokenSmoker Status");
  log("------------------");
  log(`User: ${data.name || data.email}`);
  log(`Email: ${data.email}`);
  log(`Status: ${data.status}`);

  if (data.status === "commercial") {
    if (data.planName) log(`Plan: ${data.planName}`);
    else if (data.plan) log(`Plan: ${data.plan}`);
    if (data.subscriptionStatus) log(`Subscription: ${data.subscriptionStatus}`);
    const periodEnd = formatDateOnly(data.currentPeriodEnd);
    if (periodEnd) log(`Current period ends: ${periodEnd}`);
    if (unreachable) {
      log("");
      log("(showing cached state — server unreachable)");
    }
    return;
  }

  const trial = getTrialInfo(data);
  log(`Days since activation: ${trial.daysUsed}`);

  if (data.status === "trial") {
    log(`Trial days remaining: ${trial.daysRemaining}`);
  }

  if (trial.expired) {
    log("");
    log("Trial expired. Please upgrade to continue commercial use.");
    log("To subscribe, run:");
    log("  smoke upgrade");
  } else if (trial.shouldWarn) {
    log("");
    log("Trial period nearing expiration.");
    log("To subscribe, run:");
    log("  smoke upgrade");
  }

  if (unreachable) {
    log("");
    log("(showing cached state — server unreachable)");
  }
}

module.exports = {
  status,
  getActivationData,
  getTrialInfo
};
