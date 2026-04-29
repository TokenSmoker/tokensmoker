const fs = require("fs");
const path = require("path");

function status() {
  const filePath = path.join(process.cwd(), "activation.local.json");

  if (!fs.existsSync(filePath)) {
    console.log("TokenSmoker not activated.");
    console.log("Run: tokensmoker activate");
    return;
  }

  const data = JSON.parse(fs.readFileSync(filePath));

  const activatedAt = new Date(data.activatedAt);
  const now = new Date();

  const diffDays = Math.floor(
    (now - activatedAt) / (1000 * 60 * 60 * 24)
  );

  console.log(`TokenSmoker Status`);
  console.log(`------------------`);
  console.log(`User: ${data.name}`);
  console.log(`Email: ${data.email}`);
  console.log(`Status: ${data.status}`);
  console.log(`Days since activation: ${diffDays}`);

  // Quiet period: no warnings for first 10 days
  if (data.status === "trial" && diffDays >= 10) {
    console.log("\nTrial period nearing expiration.");
  }
}

module.exports = status;
