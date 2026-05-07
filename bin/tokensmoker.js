#!/usr/bin/env node

const activate = require("../src/activate");
const { status } = require("../src/status");
const compile = require("../src/compile");
const upgrade = require("../src/upgrade");
const { HARNESSES, parseHarnessAndPrompt } = require("../src/parseHarness");

function dispatchCompile(args) {
  const { harness, prompt, error } = parseHarnessAndPrompt(args);
  if (error) {
    process.stderr.write(error + "\n");
    process.exit(1);
  }
  compile(prompt, { harness });
}

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case "activate":
    activate();
    break;

  case "compile":
    dispatchCompile(args.slice(1));
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

Harness selector (optional, defaults to auto):
  smoke design "build a marketing page with Hero, CTA, Footer"
  smoke code   "fix this function"
  smoke auto   "<prompt>"

Available harnesses: ${HARNESSES.join(", ")}

Explicit:
  tokensmoker compile "fix this function"
  tokensmoker compile design "<prompt>"
`);
    break;

  default:
    dispatchCompile(args);
}
