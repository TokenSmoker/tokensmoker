const os = require("os");
const { spawn } = require("child_process");
const { resolveApiKey } = require("./credentials");

const DEFAULT_API_URL = "https://tokensmoker-api.onrender.com";

const NOT_ACTIVATED_MESSAGE = [
  "TokenSmoker is not activated.",
  "Run:",
  "  smoke activate --email you@example.com"
].join("\n");

const INVALID_ACTIVATION_MESSAGE = [
  "TokenSmoker activation is invalid or expired.",
  "Run:",
  "  smoke activate --email you@example.com"
].join("\n");

function defaultOpenBrowser(url) {
  const platform = os.platform();
  let cmd, args;
  if (platform === "darwin") {
    cmd = "open";
    args = [url];
  } else if (platform === "win32") {
    cmd = "cmd";
    args = ["/c", "start", "", url];
  } else {
    cmd = "xdg-open";
    args = [url];
  }
  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}

async function upgrade(rawArgs, deps = {}) {
  // Backward-compatible call shape: support upgrade({...deps}) too.
  if (rawArgs && !Array.isArray(rawArgs) && typeof rawArgs === "object") {
    deps = rawArgs;
    rawArgs = [];
  }

  const fetchFn = deps.fetch || globalThis.fetch;
  const baseUrl = deps.baseUrl || process.env.TOKENSMOKER_API_URL || DEFAULT_API_URL;
  const log = deps.log || console.log;
  const errLog = deps.errLog || console.error;
  const openBrowser = deps.openBrowser || defaultOpenBrowser;
  const resolve = deps.resolveApiKey || resolveApiKey;

  const resolved = resolve();
  const apiKey = resolved && resolved.apiKey;

  if (!apiKey) {
    errLog(NOT_ACTIVATED_MESSAGE);
    return process.exit(1);
  }

  let res;
  try {
    res = await fetchFn(`${baseUrl}/billing/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({})
    });
  } catch (_err) {
    errLog("Unable to contact TokenSmoker billing service.");
    return process.exit(1);
  }

  if (res.status === 401 || res.status === 403) {
    errLog(INVALID_ACTIVATION_MESSAGE);
    return process.exit(1);
  }
  if (res.status === 404) {
    errLog("TokenSmoker account was not found.");
    return process.exit(1);
  }
  if (!res.ok) {
    errLog("Unable to contact TokenSmoker billing service.");
    return process.exit(1);
  }

  let payload;
  try {
    payload = await res.json();
  } catch {
    errLog("Unable to contact TokenSmoker billing service.");
    return process.exit(1);
  }

  // Already-paid branch: the API refused to create another Checkout Session
  // because this user already has an active subscription. Tell the user;
  // do NOT open the browser. Always route them to `smoke cancel` for
  // billing management — we never print a Stripe Billing Portal URL from
  // this command, even if the API returned manageUrl, because that URL
  // belongs to the cancel command's surface.
  if (payload && payload.alreadyUpgraded === true) {
    log("TokenSmoker is already upgraded.");
    if (payload.planName) {
      log(`Plan: ${payload.planName}`);
    } else if (payload.plan) {
      log(`Plan: ${payload.plan}`);
    }
    if (payload.subscriptionStatus) {
      log(`Status: ${payload.subscriptionStatus}`);
    }
    log("");
    log("To manage or cancel your subscription, run:");
    log("  smoke cancel");
    return;
  }

  const url =
    payload && typeof payload.url === "string" && payload.url ? payload.url : null;
  if (!url) {
    errLog("Billing service did not return a checkout URL.");
    return process.exit(1);
  }

  const opened = openBrowser(url);
  if (opened) {
    log("Opening Stripe Checkout...");
  }
  log("If your browser did not open, paste this URL:");
  log(url);
  log("");
  log("After completing checkout, run:");
  log("  smoke status");
  log("");
  log("Your local activation will refresh automatically.");
}

module.exports = upgrade;
module.exports.DEFAULT_API_URL = DEFAULT_API_URL;
module.exports.NOT_ACTIVATED_MESSAGE = NOT_ACTIVATED_MESSAGE;
module.exports.INVALID_ACTIVATION_MESSAGE = INVALID_ACTIVATION_MESSAGE;
