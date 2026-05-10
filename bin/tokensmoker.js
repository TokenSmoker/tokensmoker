#!/usr/bin/env node

const activate = require("../src/activate");
const { status } = require("../src/status");
const compile = require("../src/compile");
const { HARNESSES, parseHarnessAndPrompt } = require("../src/parseHarness");
const { parseInputFlags, readPromptFromSource } = require("../src/parseInput");
const { version: CLI_VERSION } = require("../package.json");

async function dispatchCompile(args) {
  const flags = parseInputFlags(args);
  if (flags.error) {
    process.stderr.write(flags.error + "\n");
    process.exit(1);
  }

  const { harness, prompt: positionalPrompt, error: harnessError } =
    parseHarnessAndPrompt(flags.positional);
  if (harnessError) {
    process.stderr.write(harnessError + "\n");
    process.exit(1);
  }

  const source = await readPromptFromSource({
    mode: flags.mode,
    filePath: flags.filePath,
    positionalPrompt,
    stdin: process.stdin,
    stderr: process.stderr,
    isPipedStdin: !process.stdin.isTTY,
  });

  if (source.error) {
    process.stderr.write(source.error + "\n");
    process.exit(1);
  }

  await compile(source.prompt, { harness, debug: flags.debug });
}

const args = process.argv.slice(2);
const command = args[0];

const helpText = `
TokenSmoker CLI v${CLI_VERSION}

Usage:
  tokensmoker activate
  tokensmoker status

Compile prompts:
  tokensmoker "fix this function"
  tsm "build a login route"
  smoke "clean up this React component"

Harness selector (optional, defaults to auto):
  smoke design "build a marketing page with Hero, CTA, Footer"
  smoke code   "fix this function"
  smoke docs   "rewrite the README for tokensmoker"
  smoke auto   "<prompt>"

Available harnesses: ${HARNESSES.join(", ")}

Large or shell-unfriendly prompts:
  smoke design --file prompt.txt
  smoke design -f prompt.txt
  smoke design --paste
  smoke docs --paste
  smoke docs --file prompt.txt
  cat prompt.txt | smoke design

Diagnostics:
  smoke design --debug --paste     (prints compiler version + detection)

Explicit:
  tokensmoker compile "fix this function"
  tokensmoker compile design "<prompt>"
`;

if (command === "activate") {
  activate();
} else if (command === "compile") {
  dispatchCompile(args.slice(1));
} else if (command === "status") {
  status();
} else if (command === "--help" || command === "-h") {
  console.log(helpText);
} else if (command === "--version" || command === "-v" || command === "version") {
  console.log(CLI_VERSION);
} else if (command === undefined) {
  if (!process.stdin.isTTY) {
    dispatchCompile([]);
  } else {
    console.log(helpText);
  }
} else {
  dispatchCompile(args);
}
