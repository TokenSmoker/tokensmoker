"use strict";

const HARNESSES = ["auto", "code", "design"];

function isHarnessSelector(s) {
  return typeof s === "string" && HARNESSES.includes(s);
}

// Return { harness, prompt, error? } given an array of CLI args. The first
// arg is treated as a harness selector iff it matches HARNESSES; if it looks
// like a would-be selector (single bareword followed by more args) but isn't
// known, return an error message describing the available harnesses.
function parseHarnessAndPrompt(args) {
  if (!Array.isArray(args) || args.length === 0) {
    return { harness: "auto", prompt: "" };
  }
  const first = args[0];
  if (isHarnessSelector(first)) {
    return { harness: first, prompt: args.slice(1).join(" ") };
  }
  if (/^[a-z][a-z-]{1,14}$/.test(first) && args.length > 1) {
    return {
      harness: null,
      prompt: "",
      error: `Unknown harness "${first}". Available harnesses: ${HARNESSES.join(", ")}.`,
    };
  }
  return { harness: "auto", prompt: args.join(" ") };
}

module.exports = { HARNESSES, isHarnessSelector, parseHarnessAndPrompt };
