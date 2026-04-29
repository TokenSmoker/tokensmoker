const fs = require("fs");
const path = require("path");
const prompt = require("prompt-sync")();

function activate() {
  const name = prompt("Enter your name: ");
  const email = prompt("Enter your email: ");

  const data = {
    name,
    email,
    status: "trial",
    activatedAt: new Date().toISOString()
  };

  const filePath = path.join(process.cwd(), "activation.local.json");

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  console.log(`\nTokenSmoker activated for ${name}`);
  console.log(`Status: Free trial`);
  console.log(`Started: ${data.activatedAt}`);
}

module.exports = activate;
