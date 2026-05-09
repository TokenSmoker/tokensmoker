"use strict";

// CLI rendering for the post-compile summary.
//
// v0.7.1 inverts the perceived value of the CLI: the primary surface is
// what the compiler IMPROVED about the prompt and the LIKELY OUTCOME for
// the user, not raw token reduction. Token delta is shown as a tertiary
// "Prompt delta:" line so users no longer perceive TokenSmoker as a
// compression-only tool.
//
// This module is intentionally pure — no I/O, no fetch, no fs — so the
// summary block can be unit-tested without spinning up the API path.
// `compile.js` calls `renderCompileSummary()` and prints the returned
// string verbatim.

// Per-harness copy. The strings are user-facing and load-bearing for
// positioning, so they live as data rather than inline string literals
// in the renderer. Test assertions reference this map directly.
//
// The `default` entry is used when the resolved harness is missing or
// unknown (e.g., an old API response without `harness`). It mirrors the
// docs phrasing — the most general of the three — so the fallback
// reads coherently for any prompt class.
const HARNESS_COPY = {
  code: {
    whatImproved: "Reduced prompt noise while preserving engineering intent",
    likelyOutcome: "Fewer correction prompts",
  },
  design: {
    whatImproved: "Preserved component structure and design intent",
    likelyOutcome: "Cleaner first-pass UI output",
  },
  docs: {
    whatImproved: "Preserved structure, constraints, and intent",
    likelyOutcome: "Stronger first-pass draft with fewer rewrite loops",
  },
  default: {
    whatImproved: "Preserved structure, exclusions, and intent",
    likelyOutcome: "Stronger first-pass output with fewer rewrite loops",
  },
};

// Threshold (percentage points) below which a positive token reduction
// is shown as "near-neutral; preservation prioritized" rather than as a
// reduction percentage. Anything ≥ this threshold renders as
// "<pct>% reduction". Picked to match the spec example: a 2% reduction
// (775 → 760) reads as near-neutral; a 30% reduction (775 → 543) reads
// as a reduction. 5 sits cleanly between those examples.
const NEAR_NEUTRAL_PCT = 5;

function harnessSummaryCopy(harness) {
  if (typeof harness !== "string") return HARNESS_COPY.default;
  const key = harness.toLowerCase();
  return HARNESS_COPY[key] || HARNESS_COPY.default;
}

// Build the trailing parenthetical for the Prompt delta line. Three
// regimes:
//   - diff <= 0     → "preservation-first compile"
//   - diff > 0 small → "near-neutral; preservation prioritized"
//   - diff > 0 ≥thr  → "<pct>% reduction"
// The "Saved: -X" failure shape never renders — increases land in the
// preservation-first regime instead.
function deltaTrailer(inputTokens, outputTokens) {
  const diff = inputTokens - outputTokens;
  if (diff <= 0) return "preservation-first compile";
  const pct = inputTokens > 0
    ? Math.round((diff / inputTokens) * 100)
    : 0;
  if (pct < NEAR_NEUTRAL_PCT) return "near-neutral; preservation prioritized";
  return `${pct}% reduction`;
}

// Render the compile summary block. Returns a multi-line string that
// the caller prints directly. Order is fixed:
//   1. What improved
//   2. Likely outcome
//   3. Prompt delta
function renderCompileSummary({ inputTokens, outputTokens, harness } = {}) {
  const inT = Number.isFinite(inputTokens) ? inputTokens : 0;
  const outT = Number.isFinite(outputTokens) ? outputTokens : 0;
  const copy = harnessSummaryCopy(harness);
  const trailer = deltaTrailer(inT, outT);

  const lines = [];
  lines.push("===== COMPILE SUMMARY =====");
  lines.push("");
  lines.push("What improved:");
  lines.push(copy.whatImproved);
  lines.push("");
  lines.push("Likely outcome:");
  lines.push(copy.likelyOutcome);
  lines.push("");
  lines.push("Prompt delta:");
  lines.push(`${inT} → ${outT} tokens (${trailer})`);
  return lines.join("\n");
}

module.exports = {
  HARNESS_COPY,
  NEAR_NEUTRAL_PCT,
  harnessSummaryCopy,
  deltaTrailer,
  renderCompileSummary,
};
