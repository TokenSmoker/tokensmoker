#!/usr/bin/env node

const activate = require("../src/activate");
const { status } = require("../src/status");
const compile = require("../src/compile");
const upgrade = require("../src/upgrade");

const command = process.argv[2];

switch (command) {
  case "activate":
    activate();
    break;

  case "compile":
    compile();
    break;

  case "status":
    status();
    break;

  case "upgrade":
    upgrade();
    break;

  default:
    console.log(`
TokenSmoker CLI

Usage:
  tokensmoker activate
  tokensmoker compile
  tokensmoker status
  tokensmoker upgrade
`);
}
