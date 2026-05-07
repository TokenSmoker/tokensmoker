"use strict";

const fs = require("fs");

const PASTE_MESSAGE = "Paste your prompt below. Press Ctrl+D when finished.";

function parseInputFlags(args) {
  if (!Array.isArray(args)) {
    return { mode: null, filePath: null, positional: [] };
  }

  let mode = null;
  let filePath = null;
  const positional = [];

  function setFile(path, flagName) {
    if (mode === "file") {
      return `Cannot specify ${flagName} more than once.`;
    }
    if (mode === "paste") {
      return `Cannot combine ${flagName} with --paste.`;
    }
    if (!path) {
      return `${flagName} requires a path argument.`;
    }
    mode = "file";
    filePath = path;
    return null;
  }

  for (let i = 0; i < args.length; i++) {
    const a = args[i];

    if (a === "--file" || a === "-f") {
      const next = args[i + 1];
      if (next === undefined || next.startsWith("-")) {
        return { error: `${a} requires a path argument.` };
      }
      const err = setFile(next, a);
      if (err) return { error: err };
      i++;
      continue;
    }

    if (a.startsWith("--file=")) {
      const err = setFile(a.slice("--file=".length), "--file");
      if (err) return { error: err };
      continue;
    }

    if (a.startsWith("-f=")) {
      const err = setFile(a.slice("-f=".length), "-f");
      if (err) return { error: err };
      continue;
    }

    if (a === "--paste") {
      if (mode === "file") {
        return { error: "Cannot combine --paste with --file." };
      }
      if (mode === "paste") {
        return { error: "Cannot specify --paste more than once." };
      }
      mode = "paste";
      continue;
    }

    positional.push(a);
  }

  return { mode, filePath, positional };
}

function readStreamToEnd(stream) {
  return new Promise((resolve, reject) => {
    let data = "";
    if (typeof stream.setEncoding === "function") {
      stream.setEncoding("utf8");
    }
    stream.on("data", (chunk) => {
      data += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    });
    stream.on("end", () => resolve(data));
    stream.on("error", reject);
  });
}

async function readPromptFromSource(opts) {
  const {
    mode,
    filePath,
    positionalPrompt,
    stdin,
    stderr,
    fsImpl,
    isPipedStdin,
  } = opts;

  const fileSystem = fsImpl || fs;

  if (mode === "file") {
    if (positionalPrompt) {
      return { error: "Cannot combine --file with a positional prompt." };
    }
    if (!fileSystem.existsSync(filePath)) {
      return { error: `File not found: ${filePath}` };
    }
    let content;
    try {
      content = fileSystem.readFileSync(filePath, "utf8");
    } catch (err) {
      return { error: `Could not read file ${filePath}: ${err.message}` };
    }
    if (!content || !content.trim()) {
      return { error: `File is empty: ${filePath}` };
    }
    return { prompt: content };
  }

  if (mode === "paste") {
    if (positionalPrompt) {
      return { error: "Cannot combine --paste with a positional prompt." };
    }
    if (stderr && typeof stderr.write === "function") {
      stderr.write(PASTE_MESSAGE + "\n");
    }
    const content = await readStreamToEnd(stdin);
    if (!content || !content.trim()) {
      return { error: "No prompt received on stdin." };
    }
    return { prompt: content };
  }

  if (positionalPrompt) {
    return { prompt: positionalPrompt };
  }

  if (isPipedStdin) {
    const content = await readStreamToEnd(stdin);
    if (!content || !content.trim()) {
      return { error: "No prompt received on stdin." };
    }
    return { prompt: content };
  }

  return { error: null, prompt: "" };
}

module.exports = {
  parseInputFlags,
  readPromptFromSource,
  readStreamToEnd,
  PASTE_MESSAGE,
};
