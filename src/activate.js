const fs = require("fs");
const path = require("path");
const os = require("os");

const DEFAULT_API_URL = "https://tokensmoker-api.onrender.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LEGACY_MESSAGE = [
  "Manual API key activation is no longer supported.",
  "Use:",
  "  smoke activate --email you@example.com"
].join("\n");

function parseActivateArgs(args) {
  const list = Array.isArray(args) ? args : [];
  let email = null;
  let legacyToken = false;

  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a === "--email" || a === "-e") {
      email = list[i + 1] || null;
      i++;
    } else if (typeof a === "string" && a.startsWith("--email=")) {
      email = a.slice("--email=".length);
    } else if (typeof a === "string" && !a.startsWith("-")) {
      // Bare positional: accept it if it looks like an email so users who
      // skip the flag still succeed. Anything else is treated as a legacy
      // raw API key and rejected with guidance.
      if (EMAIL_RE.test(a) && !email) {
        email = a;
      } else if (!EMAIL_RE.test(a)) {
        legacyToken = true;
      }
    }
  }

  return { email: email ? email.trim() : null, legacyToken };
}

async function activate(rawArgs, deps = {}) {
  // Backward-compatible call shape: tests may pass deps as the first arg.
  if (rawArgs && !Array.isArray(rawArgs) && typeof rawArgs === "object") {
    deps = rawArgs;
    rawArgs = [];
  }
  const args = Array.isArray(rawArgs) ? rawArgs : [];

  const fetchFn = deps.fetch || globalThis.fetch;
  const baseUrl = deps.baseUrl || process.env.TOKENSMOKER_API_URL || DEFAULT_API_URL;
  const homeDir = deps.homeDir || os.homedir();
  const log = deps.log || console.log;
  const errLog = deps.errLog || console.error;
  const isTTY =
    deps.isTTY != null
      ? !!deps.isTTY
      : !!(process.stdin && process.stdin.isTTY);
  const promptFn = deps.prompt; // only used if TTY and no --email provided

  const parsed = parseActivateArgs(args);

  if (parsed.legacyToken) {
    errLog(LEGACY_MESSAGE);
    return process.exit(1);
  }

  let email = parsed.email ? parsed.email.toLowerCase() : null;

  if (!email && isTTY) {
    const interactive = promptFn || require("prompt-sync")();
    email = (interactive("Enter your email: ") || "").trim().toLowerCase();
  }

  if (!email || !EMAIL_RE.test(email)) {
    errLog("Please provide a valid email address.");
    return process.exit(1);
  }

  let res;
  try {
    res = await fetchFn(`${baseUrl}/activate/lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
  } catch (_err) {
    errLog("Unable to contact TokenSmoker activation service.");
    return process.exit(1);
  }

  if (res.status === 404) {
    errLog(`No TokenSmoker account found for ${email}.`);
    return process.exit(1);
  }
  if (res.status === 403) {
    errLog("No active trial or subscription found for this email.");
    return process.exit(1);
  }

  let payload;
  try {
    payload = await res.json();
  } catch {
    errLog("Unable to contact TokenSmoker activation service.");
    return process.exit(1);
  }

  if (!res.ok || typeof payload.apiKey !== "string" || !payload.apiKey) {
    errLog("Unable to contact TokenSmoker activation service.");
    return process.exit(1);
  }

  const dir = path.join(homeDir, ".tokensmoker");
  const filePath = path.join(dir, "activation.json");

  // Preserve existing fields (e.g. "name") so `smoke status` continues to
  // display the same identity after re-activation.
  let existing = {};
  try {
    if (fs.existsSync(filePath)) {
      existing = JSON.parse(fs.readFileSync(filePath, "utf8")) || {};
    }
  } catch {
    existing = {};
  }

  const responseEmail =
    typeof payload.email === "string" && payload.email
      ? payload.email
      : email;
  const subscriptionStatus =
    typeof payload.subscriptionStatus === "string" && payload.subscriptionStatus
      ? payload.subscriptionStatus
      : null;
  const plan =
    typeof payload.plan === "string" && payload.plan ? payload.plan : null;
  const trialEndsAt =
    typeof payload.trialEndsAt === "string" && payload.trialEndsAt
      ? payload.trialEndsAt
      : null;

  const data = {
    name: existing.name || responseEmail,
    email: responseEmail,
    apiKey: payload.apiKey,
    status: subscriptionStatus ? "commercial" : "trial",
    licenseStatus: subscriptionStatus || existing.licenseStatus || undefined,
    plan,
    subscriptionStatus,
    trialEndsAt,
    activatedAt: new Date().toISOString()
  };

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // best-effort on platforms that don't honor mode in writeFileSync
  }

  log(`TokenSmoker activated for ${data.email}.`);
  if (plan) log(`Plan: ${plan}`);
  if (subscriptionStatus) log(`Subscription: ${subscriptionStatus}`);
}

module.exports = activate;
module.exports.DEFAULT_API_URL = DEFAULT_API_URL;
module.exports.EMAIL_RE = EMAIL_RE;
module.exports.LEGACY_MESSAGE = LEGACY_MESSAGE;
module.exports.parseActivateArgs = parseActivateArgs;
