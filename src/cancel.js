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

const NO_SUBSCRIPTION_MESSAGE =
  "No paid subscription to manage. Run `smoke upgrade` to subscribe.";

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

async function cancel(rawArgs, deps = {}) {
  // Backward-compatible call shape: support cancel({...deps}) too.
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
    res = await fetchFn(`${baseUrl}/billing/portal`, {
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
  if (res.status === 409) {
    // No paid subscription / no stripe_customer_id on record.
    errLog(NO_SUBSCRIPTION_MESSAGE);
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

  const url =
    payload && typeof payload.url === "string" && payload.url ? payload.url : null;
  if (!url) {
    errLog("Billing service did not return a portal URL.");
    return process.exit(1);
  }

  const opened = openBrowser(url);
  if (opened) {
    log("Opening billing management page...");
  } else {
    log("Manage or cancel your subscription:");
  }
  log("If your browser did not open, paste this URL:");
  log(url);
}

module.exports = cancel;
module.exports.DEFAULT_API_URL = DEFAULT_API_URL;
module.exports.NOT_ACTIVATED_MESSAGE = NOT_ACTIVATED_MESSAGE;
module.exports.INVALID_ACTIVATION_MESSAGE = INVALID_ACTIVATION_MESSAGE;
module.exports.NO_SUBSCRIPTION_MESSAGE = NO_SUBSCRIPTION_MESSAGE;
