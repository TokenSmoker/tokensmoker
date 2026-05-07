const fs = require("fs");
const path = require("path");
const os = require("os");
const prompt = require("prompt-sync")();

function activate() {
  const name = prompt("Enter your name: ");
  const email = prompt("Enter your email: ");
  const apiKeyRaw = prompt("Enter your TokenSmoker API key: ", { echo: "*" });
  const apiKey = (apiKeyRaw || "").trim();

  if (!apiKey) {
    console.error("API key is required to activate.");
    process.exit(1);
  }

  const data = {
    name,
    email,
    apiKey,
    status: "trial",
    activatedAt: new Date().toISOString()
  };

  const dir = path.join(os.homedir(), ".tokensmoker");
  const filePath = path.join(dir, "activation.json");

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });

  console.log(`\nTokenSmoker activated for ${name}`);
  console.log(`Status: Free trial`);
  console.log(`Started: ${data.activatedAt}`);
}

module.exports = activate;
