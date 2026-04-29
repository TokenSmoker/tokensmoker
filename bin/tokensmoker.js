#!/usr/bin/env node

const activate = require("../src/activate");
const { status } = require("../src/status");
const compile = require("../src/compile");
const upgrade = require("../src/upgrade");

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case "activate":
    activate();
    break;

  case "compile":
    compile(args.slice(1).join(" "));
    break;

  case "status":
    status();
    break;

  case "upgrade":
    upgrade();
    break;

  case undefined:
  case "--help":
  case "-h":
    console.log(`
TokenSmoker CLI

Usage:
  tokensmoker activate
  tokensmoker status
  tokensmoker upgrade

Compile prompts:
  tokensmoker "fix this function"
  tsm "build a login route"
  smoke "clean up this React component"

Explicit:
  tokensmoker compile "fix this function"
`);
    break;

  default:
    compile(args.join(" "));
}
