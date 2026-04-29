const { getActivationData, getTrialInfo } = require("./status");

function compile() {
  const data = getActivationData();

  if (!data) {
    console.log("TokenSmoker not activated.");
    console.log("Run: tokensmoker activate");
    return;
  }

  const trial = getTrialInfo(data);

  // Core behavior (still allow usage)
  console.log("Running compile...");

  // Soft enforcement
  if (trial.expired) {
    console.log("\nTrial expired. Please upgrade to continue commercial use.");
  } else if (trial.shouldWarn) {
    console.log(`\nTrial ending soon (${trial.daysRemaining} days remaining).`);
  }
}

module.exports = compile;
