#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { Readable } = require("stream");

const {
  parseInputFlags,
  readPromptFromSource,
  readStreamToEnd,
  PASTE_MESSAGE,
} = require(path.join(__dirname, "..", "src", "parseInput"));
const { parseHarnessAndPrompt } = require(
  path.join(__dirname, "..", "src", "parseHarness")
);

let passed = 0;
let failed = 0;
const failures = [];

function t(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`  ✓ ${name}`);
    })
    .catch((err) => {
      failed++;
      failures.push({ name, message: err.message });
      console.log(`  ✗ ${name}`);
      console.log(`      ${err.message}`);
    });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}
function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(
      `${msg || "assertion failed"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}
function assertContains(haystack, needle) {
  if (!String(haystack).includes(needle)) {
    throw new Error(`expected ${JSON.stringify(needle)} in ${JSON.stringify(haystack)}`);
  }
}

function tmpFile(name, contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tsm-input-"));
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, contents);
  return filePath;
}

function fakeStdin(text) {
  return Readable.from([text]);
}

// Mimics a paused stdin (e.g. TTY) that only delivers data after .resume().
// If consumers don't call resume(), this stream never ends — exposing the
// hang bug.
function pausedFakeStdin(chunks) {
  let resumed = false;
  let dataListener = null;
  let endListener = null;
  const stream = {
    _resumed: false,
    setEncoding() {},
    on(event, fn) {
      if (event === "data") dataListener = fn;
      if (event === "end") endListener = fn;
      return stream;
    },
    once(event, fn) {
      return stream.on(event, fn);
    },
    removeListener() {
      return stream;
    },
    resume() {
      if (resumed) return;
      resumed = true;
      stream._resumed = true;
      // Defer so listeners attached after resume() also work.
      setImmediate(() => {
        for (const c of chunks) {
          if (dataListener) dataListener(c);
        }
        if (endListener) endListener();
      });
    },
  };
  return stream;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`timed out after ${ms}ms: ${label}`)),
        ms
      )
    ),
  ]);
}

function fakeStderr() {
  const writes = [];
  return {
    writes,
    write(chunk) {
      writes.push(String(chunk));
    },
  };
}

const TAILWIND_PROMPT = [
  '<div class="grid grid-cols-[minmax(0,1fr)_320px] gap-[clamp(1rem,2vw,2.5rem)]">',
  '  <Hero className="bg-[url(\'/img/bg.png\')] text-[#1a1a1a]"',
  '        onClick={() => alert("hi (with parens) & \\"quotes\\"")} />',
  '  <Footer href="https://example.com/path?q=a&b=c" />',
  "</div>",
].join("\n");

const SPLIT_URL_PROMPT = [
  "Use this image:",
  "https://images.example.com/v2/very/long/path/that/spans/multiple/segments",
  "/and-keeps-going?width=1280&height=720&format=webp&token=abc.def-ghi_jkl",
  "Render it inside a Hero.",
].join("\n");

(async function run() {
  console.log("\n[CLI] parseInputFlags");

  await t("no flags → mode=null", () => {
    const r = parseInputFlags(["design", "build a page"]);
    assertEqual(r.mode, null);
    assertEqual(r.filePath, null);
    assertEqual(r.positional.length, 2);
  });

  await t("--file <path> → mode=file, path captured", () => {
    const r = parseInputFlags(["design", "--file", "prompt.txt"]);
    assertEqual(r.mode, "file");
    assertEqual(r.filePath, "prompt.txt");
    assertEqual(r.positional.join(","), "design");
  });

  await t("-f <path> → mode=file, path captured", () => {
    const r = parseInputFlags(["-f", "prompt.txt"]);
    assertEqual(r.mode, "file");
    assertEqual(r.filePath, "prompt.txt");
    assertEqual(r.positional.length, 0);
  });

  await t("--file=<path> form is supported", () => {
    const r = parseInputFlags(["--file=prompt.txt"]);
    assertEqual(r.mode, "file");
    assertEqual(r.filePath, "prompt.txt");
  });

  await t("--paste → mode=paste, no path", () => {
    const r = parseInputFlags(["design", "--paste"]);
    assertEqual(r.mode, "paste");
    assertEqual(r.filePath, null);
    assertEqual(r.positional.join(","), "design");
  });

  await t("--file with no path errors", () => {
    const r = parseInputFlags(["--file"]);
    assertContains(r.error, "requires a path");
  });

  await t("--file followed by another flag errors", () => {
    const r = parseInputFlags(["--file", "--paste"]);
    assertContains(r.error, "requires a path");
  });

  await t("combining --file and --paste errors", () => {
    const r = parseInputFlags(["--file", "p.txt", "--paste"]);
    assertContains(r.error, "Cannot combine");
  });

  await t("flag order does not affect harness positional", () => {
    const r = parseInputFlags(["--file", "p.txt", "design"]);
    assertEqual(r.mode, "file");
    assertEqual(r.positional.join(","), "design");
  });

  console.log("\n[CLI] readPromptFromSource");

  await t("--file with Tailwind arbitrary classes preserves content exactly", async () => {
    const filePath = tmpFile("tailwind.txt", TAILWIND_PROMPT);
    const result = await readPromptFromSource({
      mode: "file",
      filePath,
      positionalPrompt: "",
      stdin: null,
      stderr: fakeStderr(),
      isPipedStdin: false,
    });
    assert(!result.error, "should not error: " + result.error);
    assertEqual(result.prompt, TAILWIND_PROMPT);
    // Bracketed Tailwind classes survived intact.
    assertContains(result.prompt, "grid-cols-[minmax(0,1fr)_320px]");
    assertContains(result.prompt, "bg-[url('/img/bg.png')]");
  });

  await t("--file with split-line URLs preserves newlines exactly", async () => {
    const filePath = tmpFile("urls.txt", SPLIT_URL_PROMPT);
    const result = await readPromptFromSource({
      mode: "file",
      filePath,
      positionalPrompt: "",
      stdin: null,
      stderr: fakeStderr(),
      isPipedStdin: false,
    });
    assert(!result.error, "should not error: " + result.error);
    assertEqual(result.prompt, SPLIT_URL_PROMPT);
    // The line break inside the URL must be preserved (do not alter URLs).
    assertContains(result.prompt, "/segments\n/and-keeps-going");
  });

  await t("--file errors clearly when missing", async () => {
    const result = await readPromptFromSource({
      mode: "file",
      filePath: "/nonexistent/path/does/not/exist.txt",
      positionalPrompt: "",
      stdin: null,
      stderr: fakeStderr(),
      isPipedStdin: false,
    });
    assertContains(result.error, "File not found");
  });

  await t("--file errors clearly when empty", async () => {
    const filePath = tmpFile("empty.txt", "   \n\n  ");
    const result = await readPromptFromSource({
      mode: "file",
      filePath,
      positionalPrompt: "",
      stdin: null,
      stderr: fakeStderr(),
      isPipedStdin: false,
    });
    assertContains(result.error, "empty");
  });

  await t("readStreamToEnd explicitly resumes a paused stream", async () => {
    const stream = pausedFakeStdin(["hello\n", "world\n"]);
    const data = await withTimeout(
      readStreamToEnd(stream),
      500,
      "paused stdin without resume()"
    );
    assert(stream._resumed, "stream.resume() was not called");
    assertEqual(data, "hello\nworld\n");
  });

  await t("--paste resolves immediately on stream end (no hang)", async () => {
    const multiline = "first\nsecond\nthird (no trailing newline)";
    const stream = pausedFakeStdin([multiline]);
    const result = await withTimeout(
      readPromptFromSource({
        mode: "paste",
        filePath: null,
        positionalPrompt: "",
        stdin: stream,
        stderr: fakeStderr(),
        isPipedStdin: false,
      }),
      500,
      "paste mode hung after end"
    );
    assert(!result.error, "should not error: " + result.error);
    assertEqual(result.prompt, multiline);
  });

  await t("--paste with empty stdin returns missing-prompt error", async () => {
    const stream = pausedFakeStdin([]);
    const result = await withTimeout(
      readPromptFromSource({
        mode: "paste",
        filePath: null,
        positionalPrompt: "",
        stdin: stream,
        stderr: fakeStderr(),
        isPipedStdin: false,
      }),
      500,
      "empty paste hung"
    );
    assertContains(result.error, "No prompt");
  });

  await t("--paste reads stdin and prints the paste prompt to stderr", async () => {
    const multiline = "line one\nline two\n  line three (indented)\n";
    const stderr = fakeStderr();
    const result = await readPromptFromSource({
      mode: "paste",
      filePath: null,
      positionalPrompt: "",
      stdin: fakeStdin(multiline),
      stderr,
      isPipedStdin: false,
    });
    assert(!result.error, "should not error: " + result.error);
    assertEqual(result.prompt, multiline);
    assertContains(stderr.writes.join(""), PASTE_MESSAGE);
  });

  await t("piped stdin works when no positional prompt", async () => {
    const piped = "fix this function\nthat does X\n";
    const result = await readPromptFromSource({
      mode: null,
      filePath: null,
      positionalPrompt: "",
      stdin: fakeStdin(piped),
      stderr: fakeStderr(),
      isPipedStdin: true,
    });
    assert(!result.error);
    assertEqual(result.prompt, piped);
  });

  await t("piped stdin is ignored when positional prompt is provided", async () => {
    // We don't even consume the stream because we never need to.
    const result = await readPromptFromSource({
      mode: null,
      filePath: null,
      positionalPrompt: "fix login route",
      stdin: fakeStdin("STDIN CONTENT — MUST BE IGNORED"),
      stderr: fakeStderr(),
      isPipedStdin: true,
    });
    assertEqual(result.prompt, "fix login route");
  });

  await t("--file rejects combination with positional prompt", async () => {
    const filePath = tmpFile("p.txt", "hello");
    const result = await readPromptFromSource({
      mode: "file",
      filePath,
      positionalPrompt: "also some inline prompt",
      stdin: null,
      stderr: fakeStderr(),
      isPipedStdin: false,
    });
    assertContains(result.error, "Cannot combine --file");
  });

  console.log("\n[CLI] integration with parseHarnessAndPrompt");

  await t('quoted prompt still works: smoke "clean up component"', async () => {
    // Real CLI passes a quoted prompt as one arg.
    const flags = parseInputFlags(["clean up this React component"]);
    assertEqual(flags.mode, null);
    const ph = parseHarnessAndPrompt(flags.positional);
    assertEqual(ph.harness, "auto");
    assertEqual(ph.prompt, "clean up this React component");
  });

  await t("smoke design <quoted prompt> still works (no regression)", async () => {
    const flags = parseInputFlags(["design", "build a marketing page"]);
    assertEqual(flags.mode, null);
    const ph = parseHarnessAndPrompt(flags.positional);
    assertEqual(ph.harness, "design");
    assertEqual(ph.prompt, "build a marketing page");
  });

  await t("smoke code <quoted prompt> still works (TS-Code regression check)", async () => {
    const flags = parseInputFlags(["code", "fix this function"]);
    assertEqual(flags.mode, null);
    const ph = parseHarnessAndPrompt(flags.positional);
    assertEqual(ph.harness, "code");
    assertEqual(ph.prompt, "fix this function");
  });

  await t("smoke code --file p.txt routes to code harness with file source", async () => {
    const filePath = tmpFile("code-prompt.txt", "fix this function\n");
    const flags = parseInputFlags(["code", "--file", filePath]);
    assertEqual(flags.mode, "file");
    const ph = parseHarnessAndPrompt(flags.positional);
    assertEqual(ph.harness, "code");
    assertEqual(ph.prompt, "");
    const result = await readPromptFromSource({
      mode: flags.mode,
      filePath: flags.filePath,
      positionalPrompt: ph.prompt,
      stdin: null,
      stderr: fakeStderr(),
      isPipedStdin: false,
    });
    assert(!result.error);
    assertEqual(result.prompt, "fix this function\n");
  });

  await t("smoke design --paste keeps harness=design", async () => {
    const flags = parseInputFlags(["design", "--paste"]);
    assertEqual(flags.mode, "paste");
    const ph = parseHarnessAndPrompt(flags.positional);
    assertEqual(ph.harness, "design");
    assertEqual(ph.prompt, "");
  });

  await t("--debug parses to debug:true and is stripped from positional", () => {
    const flags = parseInputFlags(["design", "--debug", "--paste"]);
    assertEqual(flags.mode, "paste");
    assertEqual(flags.debug, true);
    const ph = parseHarnessAndPrompt(flags.positional);
    assertEqual(ph.harness, "design");
  });

  await t("absence of --debug → debug:false", () => {
    const flags = parseInputFlags(["design", "--paste"]);
    assertEqual(flags.debug, false);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.message}`);
    }
    process.exit(1);
  }
})();
