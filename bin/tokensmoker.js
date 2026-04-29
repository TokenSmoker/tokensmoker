#!/usr/bin/env node

const command = process.argv[2];

switch (command) {
  case "activate":
    console.log("Running activation...");
    break;

  case "compile":
    console.log("Running compile...");
    break;

  case "status":
    console.log("Checking status...");
    break;

  default:
    console.log(`
TokenSmoker CLI

Usage:
  tokensmoker activate
  tokensmoker compile
  tokensmoker status
`);
}
