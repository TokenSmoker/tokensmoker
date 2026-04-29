const fs = require("fs");
const path = require("path");
const os = require("os");
const prompt = require("prompt-sync")();

function maskLicenseKey(key) {
  const clean = key.trim();

  return {
    licenseLast4: clean.slice(-4),
    licenseLength: clean.length
  };
}

function upgrade() {
  const filePath = path.join(os.homedir(), ".tokensmoker", "activation.json");

  if (!fs.existsSync(filePath)) {
    console.log("TokenSmoker not activated.");
    console.log("Run: tokensmoker activate first.");
    return;
  }

  const licenseKey = prompt("Enter commercial license key: ");

  if (!licenseKey || licenseKey.trim().length < 8) {
    console.log("Invalid license key.");
    return;
  }

  const data = JSON.parse(fs.readFileSync(filePath));
  const masked = maskLicenseKey(licenseKey);

  delete data.licenseKey;

  data.status = "commercial";
  data.licenseStatus = "valid";
  data.licenseLast4 = masked.licenseLast4;
  data.licenseLength = masked.licenseLength;
  data.upgradedAt = new Date().toISOString();

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  console.log(`\nTokenSmoker upgraded for ${data.name}`);
  console.log("Status: Commercial");
  console.log(`License: ****${data.licenseLast4}`);
}

module.exports = upgrade;
