const { getActivationData, getTrialInfo } = require("./status");
const sendReport = require("./report");

function compile() {
  const data = getActivationData();

  if (!data) {
    console.log("TokenSmoker not activated.");
    console.log("Run: tokensmoker activate");
    return;
  }

  const trial = getTrialInfo(data);

  console.log("Running compile...");

  if (trial.expired) {
    console.log("\nTrial expired. Please upgrade to continue commercial use.");

    // Report expiry (once per run, fine for now)
    sendReport("trial_expired", {
      name: data.name,
      email: data.email
    });

  } else if (trial.shouldWarn) {
    console.log(`\nTrial ending soon (${trial.daysRemaining} days remaining).`);
  }
}

module.exports = compile;
