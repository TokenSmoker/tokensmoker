#!/usr/bin/env node

const status = require("../src/status");

const activate = require("../src/activate");

const command = process.argv[2];

switch (command) {
  case "activate":
    activate();
    break;

  case "compile":
    console.log("Running compile...");
    break;

  case "status":
    status();
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
