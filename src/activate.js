const fs = require("fs");
const path = require("path");
const os = require("os");

const DEFAULT_API_URL = "https://tokensmoker-api.onrender.com";

async function activate(deps = {}) {
  const promptFn = deps.prompt || require("prompt-sync")();
  const fetchFn = deps.fetch || globalThis.fetch;
  const baseUrl = deps.baseUrl || process.env.TOKENSMOKER_API_URL || DEFAULT_API_URL;
  const homeDir = deps.homeDir || os.homedir();
  const log = deps.log || console.log;
  const errLog = deps.errLog || console.error;

  const name = (promptFn("Enter your name: ") || "").trim();
  const email = (promptFn("Enter your email: ") || "").trim();

  if (!name) {
    errLog("Name is required.");
    return process.exit(1);
  }
  if (!email) {
    errLog("Email is required.");
    return process.exit(1);
  }

  let res;
  try {
    res = await fetchFn(`${baseUrl}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email })
    });
  } catch (err) {
    errLog(`Activation failed: ${err.message}`);
    return process.exit(1);
  }

  let payload;
  try {
    payload = await res.json();
  } catch {
    errLog(`Activation failed: invalid response from server`);
    return process.exit(1);
  }

  if (!res.ok) {
    const msg = (payload && payload.error) || `${res.status} ${res.statusText}`;
    errLog(`Activation failed: ${msg}`);
    return process.exit(1);
  }

  if (typeof payload.apiKey !== "string" || !payload.apiKey) {
    errLog("Activation failed: server did not return an API key");
    return process.exit(1);
  }

  const data = {
    name: payload.name || name,
    email: payload.email || email,
    apiKey: payload.apiKey,
    status: payload.status || "trial",
    startedAt: payload.startedAt,
    trialDaysRemaining: payload.trialDaysRemaining,
    activatedAt: new Date().toISOString()
  };

  const dir = path.join(homeDir, ".tokensmoker");
  const filePath = path.join(dir, "activation.json");

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // best-effort on platforms that don't honor mode in writeFileSync
  }

  log(`\nTokenSmoker activated for ${data.name}`);
  log(`Status: ${data.status === "trial" ? "Free trial" : data.status}`);
  if (typeof data.trialDaysRemaining === "number") {
    log(`Trial days remaining: ${data.trialDaysRemaining}`);
  }
  if (data.startedAt) {
    log(`Started: ${data.startedAt}`);
  }
}

module.exports = activate;
module.exports.DEFAULT_API_URL = DEFAULT_API_URL;
