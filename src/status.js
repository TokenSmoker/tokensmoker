const fs = require("fs");
const path = require("path");
const os = require("os");

const TRIAL_DAYS = 14;
const QUIET_DAYS = 10;

function getActivationData() {
  const filePath = path.join(os.homedir(), ".tokensmoker", "activation.json");

  if (!fs.existsSync(filePath)) {
    return null;
  }

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

function status() {
  const data = getActivationData();

  if (!data) {
    console.log("TokenSmoker not activated.");
    console.log("Run: tokensmoker activate");
    return;
  }

  const trial = getTrialInfo(data);

  console.log(`TokenSmoker Status`);
  console.log(`------------------`);
  console.log(`User: ${data.name}`);
  console.log(`Email: ${data.email}`);
  console.log(`Status: ${data.status}`);
  console.log(`Days since activation: ${trial.daysUsed}`);

  if (data.status === "trial") {
    console.log(`Trial days remaining: ${trial.daysRemaining}`);
  }

  if (trial.expired) {
    console.log("\nTrial expired. Please upgrade to continue commercial use.");
  } else if (trial.shouldWarn) {
    console.log("\nTrial period nearing expiration.");
  }
}

module.exports = {
  status,
  getActivationData,
  getTrialInfo
};
