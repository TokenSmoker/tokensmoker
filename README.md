# TokenSmoker

TokenSmoker is a multi-harness prompt compiler. Each harness preserves
the load-bearing content of its prompt class — code, design, or docs —
so models produce stronger first-pass output with fewer rewrite loops.
Token reduction often follows; the bigger win is fewer rewrite loops
downstream.

---

## What TokenSmoker does

For most teams, the per-call token bill is small compared to the rework
cost. The model misreads the prompt, drops a constraint, ignores an
exclusion, restructures the deliverable, and the next ten minutes go to
re-prompting.

TokenSmoker compiles a long, messy prompt into a shorter, denser brief
the model can actually act on:

- **Stronger first-pass output** — load-bearing constraints survive
  intact.
- **Fewer rewrite loops** — exclusions, structure, and intent are
  preserved, not summarized away.
- **Reduced context resend** — the brief is small enough to keep
  follow-up room.
- **Lower per-call token burn** — often, but not always; some prompts
  should compress less, not more.

---

## Why harness-specific compilation

A coding prompt and a design prompt share almost no structure. A docs
prompt shares even less. Generalized compression — one compressor for
every prompt class — quietly destroys things that matter:

- exclusions (`do not include …`, `avoid X`, anti-hype rules)
- component ownership topology (Hero → Features → CTA ordering, asset
  URLs, exact quoted UI copy)
- engineering constraints (stack traces, file paths, tech stack, library
  pinning)
- deliverable shape (required sections, output format, length caps)
- benchmark philosophy and narrative intent (audience, tone, caveats,
  limitations, anti-hype positioning)

TokenSmoker dispatches each prompt to a domain-specific *harness*. Each
harness has its own preservation contract — the content it is designed
not to drop, even at the cost of a smaller reduction.

---

## Live harnesses

**TS-Code** — preserves engineering fidelity while reducing prompt
waste. Stack traces, file paths, tech stack, and the actual ask survive;
narrative scaffolding around them is collapsed. Byte-stable through the
harness router on canonical refactor prompts.

**TS-Design** — preserves component ownership topology and design
semantics. Hero / Features / CTA ordering, Tailwind arbitrary classes,
quoted UI copy, asset URLs, icons, and animations survive verbatim;
narrative project-brief framing is dropped.

**TS-Docs** — preserves semantic structure, constraints, and author
intent for document-authoring prompts (READMEs, PRDs, technical briefs,
investor summaries, release notes, internal specs, landing-page copy
briefs). Required sections, exclusions, audience, tone, deliverable
shape, and any narrative hierarchy are surfaced as a writing brief —
not as compressed prose. TS-Docs is preservation-first: it deliberately
accepts lower reduction percentages to keep nuance.

| Harness | Auto-detect | Status |
|---|---|---|
| TS-Code | yes | live |
| TS-Design | yes | live |
| TS-Docs | no — user-selected | live |
| TS-CAD | — | planned |
| TS-Agent | — | planned |

---

## Built for real-world prompts

TokenSmoker is designed for the prompts people actually paste, not toy
snippets:

- multiline prompts and multi-task prompts
- coding prompts with stack traces, file paths, and engineering
  constraints
- design prompts with per-component sections, asset lists, and quoted UI
  copy
- docs prompts with required sections, exclusions, anti-hype rules, and
  audience / tone constraints
- Purchased User Prompts (PUPs) — long, narrative-heavy briefs of the
  kind users buy or commission and paste in whole

---

## Installation

```bash
# from npm
npm install -g tokensmoker

# or directly from GitHub
npm install -g github:TokenSmoker/tokensmoker
```

Three equivalent binaries: `tokensmoker`, `tsm`, and `smoke`.

---

## Activation

```bash
tokensmoker activate
```

Activation asks for your name and email. Credentials are provisioned
automatically — there is no API key to copy, paste, or rotate by hand.
The trial is global per user, not per project.

```bash
tokensmoker status
```

Prints the activation state, plan, and trial days remaining.

---

## Quick start

Explicit harness selection is recommended whenever you know the domain.
It skips detection and produces deterministic output.

```bash
smoke code   "fix this Express login route, missing validation breaks it"
smoke code   --file prompt.txt
smoke code   --paste

smoke design --paste
smoke design --file mockup.txt

smoke docs   --paste
smoke docs   --file readme-rewrite.txt
```

If no harness is specified, TokenSmoker attempts auto-detection:

```bash
smoke "..."
```

Auto-detect routes between TS-Code and TS-Design today. TS-Docs is
user-selected — pass `docs` explicitly. Auto-detect will not silently
route a docs prompt to the code or design harness.

---

## Paste workflow

For prompts longer than a single shell-friendly line, use `--paste`.
This is the recommended workflow for TS-Design and TS-Docs, where
prompts often run several hundred lines.

```bash
smoke docs --paste
```

You'll see:

```
Paste your prompt below.

When finished:
1. Press Enter to start a new blank line
2. Press Ctrl+D to compile
```

The blank line matters — most terminals require an empty line before
`Ctrl+D` will flush the input buffer.

For prompts already saved to disk:

```bash
smoke docs --file prompt.txt
```

Or pipe directly:

```bash
cat prompt.txt | smoke docs
```

---

## Example compile output

A real Purchased User Prompt — a long, narrative-heavy design brief
of the kind users buy or commission and paste in whole — shown as an
excerpt:

```text
# Project Brief — DeFi Landing Page

We are building a premium DeFi landing page for institutional traders.
The page must convert technical decision-makers within 30 seconds. The
aesthetic should feel cinematic, dense, and high-trust.

## Stack
Use React, Vite, Tailwind CSS, Framer Motion, Lucide React, and
shadcn/ui.

## 1. Hero Section (Hero.tsx)
- background video: https://cdn.example.com/hero/loop.mp4 looping autoplay
- copy headline: "Liquid markets, institutional grade"
- copy subhead: "Trade tokenized treasuries, FX swaps, and custom basis trades."
- buttons: "Launch App", "Read Docs", "Talk to Sales"
- icons: ArrowUpRight, Sparkles
- classes: bg-[#0a0a0a] rounded-[3rem] backdrop-blur-md hover:scale-[1.02]
- animation: fade-in on scroll, parallax on the headline

[ ... 4 more component sections ... ]

## 6. Footer Section (Footer.tsx)
- logo: https://cdn.example.com/brand/logo.svg
- links to /privacy and /terms and /docs and /github
```

Compiled output (excerpt):

```text
Task:
Build premium DeFi landing page

Tech: React, Framer Motion, Lucide React, Vite, Tailwind CSS, shadcn/ui

Setup: font "Inter Variable"; main min-h-screen bg-[#0a0a0a]; body background #0a0a0a

Components:
- Hero: bg video https://cdn.example.com/hero/loop.mp4; "Liquid markets, institutional grade", "Launch App", "Read Docs", "Talk to Sales"; bg-[#0a0a0a] rounded-[3rem] backdrop-blur-md hover:scale-[1.02]; ArrowUpRight, Sparkles; fade-in, parallax
- Footer: logo: https://cdn.example.com/brand/logo.svg; links: /privacy, /terms, /docs, /github
```

CLI summary (TS-Design):

```
===== COMPILE SUMMARY =====

What improved:
Preserved component structure and design intent

Likely outcome:
Cleaner first-pass UI output

Prompt delta:
1254 → 415 tokens (67% reduction)
```

For a docs prompt, the same summary block reflects the docs preservation
contract:

```
===== COMPILE SUMMARY =====

What improved:
Preserved structure, constraints, and intent

Likely outcome:
Stronger first-pass draft with fewer rewrite loops

Prompt delta:
775 → 543 tokens (30% reduction)
```

When preservation matters more than compression, the delta line shows
that intent honestly:

```
Prompt delta:
686 → 760 tokens (preservation-first compile)
```

---

## Why prompt improvement matters

Token reduction is real, and we measure it. It's also the wrong primary
metric. Teams adopt TokenSmoker because the compiled brief is denser
and more structured — leaving the model less room to misread:

- exclusions get honored on the first pass
- required sections actually appear in the output
- tone and audience constraints survive
- engineering constraints don't get summarized into vagueness

Some prompts compile to a much smaller token count. Some — especially
docs prompts with high semantic load — compile to roughly the same
size, or slightly larger, because preservation is the right call. Both
outcomes are first-class.

---

## Available commands

```bash
tokensmoker activate              # provision credentials
tokensmoker status                # check plan and trial state

smoke "..."                       # auto-detect (code or design)
smoke code "..."                  # force TS-Code
smoke design --paste              # TS-Design, paste from terminal
smoke design --file prompt.txt    # TS-Design, read from file
smoke docs --paste                # TS-Docs, paste from terminal
smoke docs --file prompt.txt      # TS-Docs, read from file
```

`tsm` and `smoke` are aliases for `tokensmoker` — use whichever fits
your muscle memory.

### Legacy / compatibility

```bash
tokensmoker compile "..."
tokensmoker compile design "..."
```

Still supported for older scripts. New work should use `smoke <harness>`
directly.

---

## Current status

- **TS-Code** — live, deterministic, byte-stable through the harness
  router on canonical refactor prompts.
- **TS-Design** — live, component-line output, ~65% reduction on real
  PUPs.
- **TS-Docs** — live, preservation-first; reduction varies (some prompts
  compile to roughly the same size by design). User-selected — no
  auto-detect in v1.
- TS-CAD and TS-Agent are planned; scaffold-only today.

Active iteration on all three live harnesses.
