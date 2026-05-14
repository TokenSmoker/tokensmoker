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
| TS-Docs | user-selected for now | live |
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
npm install -g tokensmoker
```

Installs three equivalent CLI binaries:

- `smoke` — preferred public command
- `tsm` — shorthand for code-oriented use
- `tokensmoker` — full command name

Use whichever fits your muscle memory. All three accept the same
arguments.

---

## Quick start

```bash
npm install -g tokensmoker
smoke activate --email you@example.com
smoke status
smoke code "paste or type your prompt here"
```

That's the full path from install to a compiled prompt. Activation is
keyless — you give the CLI your email, it provisions credentials over
TLS, and writes them to `~/.tokensmoker/activation.json` for you. There
is no API key to copy, paste, or rotate by hand.

---

## Activation

```bash
smoke activate --email you@example.com
```

The CLI looks up your TokenSmoker account by email and writes a fresh
local activation file. If you already have an account (trial or
subscription), this is everything you need to do.

```bash
smoke status
```

Prints the activation state, plan, and trial days remaining.

```bash
smoke upgrade
```

After activation, opens Stripe Checkout in your browser to subscribe to
the Starter plan. The trial is global per user, not per project. After
payment, run `smoke status` — your local activation refreshes
automatically; you do not need to rerun `smoke activate`.

`smoke upgrade` is idempotent. If you are already on a paid plan, it
will **not** create another Checkout session and will **not** charge you
again. It prints your current plan and status, and points you at
`smoke cancel` for any billing changes:

```text
TokenSmoker is already upgraded.
Plan: Starter Monthly
Status: active

To manage or cancel your subscription, run:
  smoke cancel
```

```bash
smoke cancel
```

Opens the billing management page (Stripe Billing Portal) in your
browser so you can update payment details, switch plans, or cancel.
`smoke cancel` does **not** cancel directly from the CLI — every
billing change happens on Stripe's hosted page, where you can confirm
or back out.

---

## Compiling prompts

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
# Activation, status, upgrade, cancel
tokensmoker activate --email you@example.com
smoke        activate --email you@example.com
tokensmoker status
smoke        status
smoke        upgrade              # upgrade from trial to a paid plan
smoke        cancel               # open billing management to manage or cancel your subscription

# Compile prompts
smoke "paste or type your prompt here"                # auto-detect
smoke code   "paste or type your prompt here"         # force TS-Code
smoke design --paste                                  # TS-Design, paste
smoke design --file prompt.txt                        # TS-Design, file
smoke docs   --paste                                  # TS-Docs, paste
smoke docs   --file prompt.txt                        # TS-Docs, file
```

`smoke`, `tsm`, and `tokensmoker` are equivalent binaries — pick one.

---

## Troubleshooting

**Not activated** — `smoke status` or `smoke upgrade` reports that
TokenSmoker is not activated.

```bash
smoke activate --email you@example.com
```

**`No TokenSmoker account found for <email>.`** — the email you passed
does not have a TokenSmoker account yet. Start a trial or subscribe at
[tokensmoker.com](https://tokensmoker.com), then re-run
`smoke activate --email <that email>`.

**`Please provide a valid email address.`** — the value passed to
`--email` was not a valid email. Re-run with a real address, e.g.
`smoke activate --email you@example.com`.

**Expired or invalid local activation** — the API rejected your stored
credentials (for example, after a long gap, or if the local file was
edited). Re-activate:

```bash
smoke activate --email you@example.com
```

**Subscribe / upgrade trial** — after activation, run:

```bash
smoke upgrade
```

This opens Stripe Checkout in your browser. You do not need to copy or
paste anything afterwards; the next `smoke status` (or any compile)
refreshes your local activation from the server automatically. You
should not need to rerun `smoke activate` after payment.

If you are already on a paid plan, `smoke upgrade` is a no-op — it
will not open Checkout, will not create another session, and will not
charge you again. It prints your current plan and tells you to run
`smoke cancel` for any billing changes.

**Manage or cancel your subscription** — open the billing management
page:

```bash
smoke cancel
```

`smoke cancel` does not cancel directly from the CLI; it opens the
Stripe Billing Portal where you can update payment details, switch
plans, or cancel.

---

## Advanced

`TOKENSMOKER_API_URL` overrides the default API host. This is only
useful for development and self-hosting; normal users do not need to
set it.

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
