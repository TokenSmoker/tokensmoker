#!/usr/bin/env node
"use strict";

// CLI render tests — covers the post-compile summary block introduced
// in cli v0.7.1. Custom test runner shape (matches the rest of the CLI
// test suite). Asserts:
//
//   1. Section ordering — What improved → Likely outcome → Prompt delta
//   2. Per-harness copy strings (code / design / docs / default)
//   3. All three Prompt delta regimes (reduction / near-neutral / preservation-first)
//   4. The negative-savings safety: increases never render as "-X tokens"
//      or "Added: …", only as "preservation-first compile"
//   5. The pre-v0.7.1 "===== ESTIMATE =====" header is gone (no leakage)
//   6. Pure function — no I/O, no side effects, no fetch.

const path = require("path");
const {
  HARNESS_COPY,
  NEAR_NEUTRAL_PCT,
  harnessSummaryCopy,
  deltaTrailer,
  renderCompileSummary,
} = require(path.join(__dirname, "..", "src", "render"));

let passed = 0;
let failed = 0;
const failures = [];

function t(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, message: err.message });
    console.log(`  ✗ ${name}`);
    console.log(`      ${err.message}`);
  }
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
function assertContains(haystack, needle, msg) {
  if (!String(haystack).includes(needle)) {
    throw new Error(
      `${msg || "expected substring missing"}: ${JSON.stringify(needle)} not found in:\n---\n${haystack}\n---`
    );
  }
}
function assertNotContains(haystack, needle, msg) {
  if (String(haystack).includes(needle)) {
    throw new Error(
      `${msg || "unexpected substring present"}: ${JSON.stringify(needle)} found in:\n---\n${haystack}\n---`
    );
  }
}

// ── 1. Harness copy map ────────────────────────────────────────────────────

console.log("\n[CLI] HARNESS_COPY content lock");

t("code copy matches the spec strings", () => {
  assertEqual(HARNESS_COPY.code.whatImproved,
    "Reduced prompt noise while preserving engineering intent");
  assertEqual(HARNESS_COPY.code.likelyOutcome,
    "Fewer correction prompts");
});

t("design copy matches the spec strings", () => {
  assertEqual(HARNESS_COPY.design.whatImproved,
    "Preserved component structure and design intent");
  assertEqual(HARNESS_COPY.design.likelyOutcome,
    "Cleaner first-pass UI output");
});

t("docs copy matches the spec strings", () => {
  assertEqual(HARNESS_COPY.docs.whatImproved,
    "Preserved structure, constraints, and intent");
  assertEqual(HARNESS_COPY.docs.likelyOutcome,
    "Stronger first-pass draft with fewer rewrite loops");
});

t("default copy mirrors the canonical example", () => {
  assertEqual(HARNESS_COPY.default.whatImproved,
    "Preserved structure, exclusions, and intent");
  assertEqual(HARNESS_COPY.default.likelyOutcome,
    "Stronger first-pass output with fewer rewrite loops");
});

t("harnessSummaryCopy resolves known harnesses", () => {
  assertEqual(harnessSummaryCopy("code"), HARNESS_COPY.code);
  assertEqual(harnessSummaryCopy("design"), HARNESS_COPY.design);
  assertEqual(harnessSummaryCopy("docs"), HARNESS_COPY.docs);
});

t("harnessSummaryCopy is case-insensitive", () => {
  assertEqual(harnessSummaryCopy("CODE"), HARNESS_COPY.code);
  assertEqual(harnessSummaryCopy("Docs"), HARNESS_COPY.docs);
});

t("harnessSummaryCopy falls back for missing/unknown/auto", () => {
  // "auto" is the harness selector but the resolved harness from the API
  // should be one of code/design/docs. If it's still "auto" or absent, we
  // use the default copy.
  assertEqual(harnessSummaryCopy(undefined), HARNESS_COPY.default);
  assertEqual(harnessSummaryCopy(null), HARNESS_COPY.default);
  assertEqual(harnessSummaryCopy(""), HARNESS_COPY.default);
  assertEqual(harnessSummaryCopy("auto"), HARNESS_COPY.default);
  assertEqual(harnessSummaryCopy("banana"), HARNESS_COPY.default);
  assertEqual(harnessSummaryCopy(42), HARNESS_COPY.default);
});

t("no copy string mentions banned internal terms (Profile/Mode/topology/etc.)", () => {
  // The brief explicitly forbids surfacing internal vocabulary in the
  // user-facing summary. Lock the copy strings against drift back into
  // those terms.
  const banned = [
    /\bProfile\b/i,
    /\bMode\b/i,
    /\bsemantic\s+channels?\b/i,
    /\btopology\b/i,
    /\bscoring\b/i,
    /\binference\b/i,
  ];
  for (const key of Object.keys(HARNESS_COPY)) {
    const c = HARNESS_COPY[key];
    for (const re of banned) {
      assert(!re.test(c.whatImproved),
        `${key}.whatImproved leaks banned term ${re}: "${c.whatImproved}"`);
      assert(!re.test(c.likelyOutcome),
        `${key}.likelyOutcome leaks banned term ${re}: "${c.likelyOutcome}"`);
    }
  }
});

// ── 2. Prompt delta regimes ────────────────────────────────────────────────

console.log("\n[CLI] deltaTrailer regimes");

t("≥5% reduction renders as '<pct>% reduction'", () => {
  assertEqual(deltaTrailer(775, 543), "30% reduction");
  assertEqual(deltaTrailer(1000, 500), "50% reduction");
  assertEqual(deltaTrailer(100, 95), "5% reduction"); // boundary
});

t("positive but <5% reduction renders as 'near-neutral; preservation prioritized'", () => {
  assertEqual(deltaTrailer(775, 760), "near-neutral; preservation prioritized");
  assertEqual(deltaTrailer(100, 99), "near-neutral; preservation prioritized");
});

t("token increase renders as 'preservation-first compile'", () => {
  assertEqual(deltaTrailer(686, 760), "preservation-first compile");
  assertEqual(deltaTrailer(500, 1000), "preservation-first compile");
});

t("zero delta renders as 'preservation-first compile' (not 0% reduction)", () => {
  assertEqual(deltaTrailer(500, 500), "preservation-first compile");
});

t("zero-input edge case does not crash and renders preservation-first", () => {
  assertEqual(deltaTrailer(0, 0), "preservation-first compile");
  assertEqual(deltaTrailer(0, 100), "preservation-first compile");
});

t("NEAR_NEUTRAL_PCT threshold is the documented value", () => {
  assertEqual(NEAR_NEUTRAL_PCT, 5,
    "rendering threshold drifted — update tests if this is intentional");
});

// ── 3. Full-block render ──────────────────────────────────────────────────

console.log("\n[CLI] renderCompileSummary block");

t("emits the canonical '===== COMPILE SUMMARY =====' header", () => {
  const out = renderCompileSummary({ inputTokens: 100, outputTokens: 50, harness: "code" });
  assertContains(out, "===== COMPILE SUMMARY =====");
});

t("section ordering is What improved → Likely outcome → Prompt delta", () => {
  const out = renderCompileSummary({ inputTokens: 775, outputTokens: 543, harness: "docs" });
  const wi = out.indexOf("What improved:");
  const lo = out.indexOf("Likely outcome:");
  const pd = out.indexOf("Prompt delta:");
  assert(wi >= 0 && lo >= 0 && pd >= 0,
    `at least one section header missing in:\n${out}`);
  assert(wi < lo, "What improved must precede Likely outcome");
  assert(lo < pd, "Likely outcome must precede Prompt delta");
});

t("docs harness — full canonical example matches the spec", () => {
  const out = renderCompileSummary({ inputTokens: 775, outputTokens: 543, harness: "docs" });
  // Match the spec's example block byte-for-byte (modulo the surrounding
  // header line, which is part of the renderer output).
  const expected =
    "===== COMPILE SUMMARY =====\n\n" +
    "What improved:\nPreserved structure, constraints, and intent\n\n" +
    "Likely outcome:\nStronger first-pass draft with fewer rewrite loops\n\n" +
    "Prompt delta:\n775 → 543 tokens (30% reduction)";
  assertEqual(out, expected, "docs render diverged from spec example");
});

t("code harness — copy + 30% reduction", () => {
  const out = renderCompileSummary({ inputTokens: 775, outputTokens: 543, harness: "code" });
  assertContains(out, "Reduced prompt noise while preserving engineering intent");
  assertContains(out, "Fewer correction prompts");
  assertContains(out, "775 → 543 tokens (30% reduction)");
});

t("design harness — copy + 30% reduction", () => {
  const out = renderCompileSummary({ inputTokens: 775, outputTokens: 543, harness: "design" });
  assertContains(out, "Preserved component structure and design intent");
  assertContains(out, "Cleaner first-pass UI output");
  assertContains(out, "775 → 543 tokens (30% reduction)");
});

t("near-neutral regime — 775 → 760 renders the spec phrasing", () => {
  const out = renderCompileSummary({ inputTokens: 775, outputTokens: 760, harness: "docs" });
  assertContains(out, "775 → 760 tokens (near-neutral; preservation prioritized)");
});

t("token increase — 686 → 760 renders preservation-first compile", () => {
  const out = renderCompileSummary({ inputTokens: 686, outputTokens: 760, harness: "docs" });
  assertContains(out, "686 → 760 tokens (preservation-first compile)");
});

// ── 4. Negative-savings safety ─────────────────────────────────────────────

console.log("\n[CLI] negative-savings safety guards");

t("increase never renders 'Saved:' or 'Added:' label", () => {
  const out = renderCompileSummary({ inputTokens: 686, outputTokens: 760, harness: "code" });
  assertNotContains(out, "Saved:", "pre-v0.7.1 'Saved:' label leaked into v0.7.1 output");
  assertNotContains(out, "Added:", "pre-v0.7.1 'Added:' label leaked into v0.7.1 output");
});

t("increase never renders a negative number with a leading dash", () => {
  const out = renderCompileSummary({ inputTokens: 686, outputTokens: 760, harness: "code" });
  // The spec is explicit: "Saved: -X" must not print. The renderer never
  // emits negative absolute deltas in any form.
  assert(!/-\d+\s+tokens/.test(out),
    `negative-token shape rendered:\n${out}`);
});

t("near-neutral never renders 'Saved:' or 'Added:' label", () => {
  const out = renderCompileSummary({ inputTokens: 775, outputTokens: 760, harness: "code" });
  assertNotContains(out, "Saved:");
  assertNotContains(out, "Added:");
});

// ── 5. No leak from pre-v0.7.1 ESTIMATE block ──────────────────────────────

console.log("\n[CLI] pre-v0.7.1 ESTIMATE block fully removed");

t("the old '===== ESTIMATE =====' header is gone", () => {
  for (const h of ["code", "design", "docs", "auto"]) {
    const out = renderCompileSummary({ inputTokens: 775, outputTokens: 543, harness: h });
    assertNotContains(out, "===== ESTIMATE =====",
      `legacy ESTIMATE header leaked for harness=${h}`);
  }
});

t("the old 'Additional savings likely…' filler line is gone", () => {
  const out = renderCompileSummary({ inputTokens: 775, outputTokens: 543, harness: "docs" });
  assertNotContains(out, "Additional savings likely",
    "pre-v0.7.1 'Additional savings…' filler leaked into v0.7.1 output");
});

t("Input:/Output: per-line tokens are gone (rolled into Prompt delta)", () => {
  const out = renderCompileSummary({ inputTokens: 775, outputTokens: 543, harness: "docs" });
  // The new block has the delta on a single "Prompt delta:" line. There
  // are no separate "Input: X tokens" / "Output: X tokens" lines — that
  // was the pre-v0.7.1 framing.
  assertNotContains(out, "Input:  775");
  assertNotContains(out, "Output: 543");
});

// ── 6. Pure-function invariants ────────────────────────────────────────────

console.log("\n[CLI] renderCompileSummary purity");

t("renderCompileSummary returns a string (no I/O, no console writes)", () => {
  // Capture console.log to prove the renderer doesn't emit anything itself.
  const origLog = console.log;
  const captured = [];
  console.log = (...args) => captured.push(args.join(" "));
  let out;
  try {
    out = renderCompileSummary({ inputTokens: 100, outputTokens: 50, harness: "code" });
  } finally {
    console.log = origLog;
  }
  assertEqual(typeof out, "string");
  assertEqual(captured.length, 0,
    `renderCompileSummary printed to console: ${captured.join(" | ")}`);
});

t("renderCompileSummary is deterministic for fixed inputs", () => {
  const a = renderCompileSummary({ inputTokens: 775, outputTokens: 543, harness: "docs" });
  const b = renderCompileSummary({ inputTokens: 775, outputTokens: 543, harness: "docs" });
  assertEqual(a, b);
});

t("renderCompileSummary tolerates missing/invalid arg shapes", () => {
  // Defensive — undefined input falls back to 0 tokens / default copy.
  // Exercise this so a downstream API change that omits a field doesn't
  // crash the CLI.
  const out = renderCompileSummary({});
  assertContains(out, "===== COMPILE SUMMARY =====");
  assertContains(out, "0 → 0 tokens");
  // Also tolerates no argument at all.
  const out2 = renderCompileSummary();
  assertContains(out2, "===== COMPILE SUMMARY =====");
});

// ── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.message}`);
  }
  process.exit(1);
}
