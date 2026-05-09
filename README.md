# TokenSmoker

TokenSmoker compiles large, messy prompts into smaller, more model-efficient representations.

---

## Why TokenSmoker

**Significant token reduction.**
Compiled prompts are typically 40–90% smaller than the source, depending on
how repetitive and structured the input is. Smaller prompts leave more room
for context, reduce truncation risk, and lower per-call token cost.

**Better outputs with fewer iterations.**
The compiler preserves the structure that matters — requirements,
constraints, component topology, asset URLs, exact copy — and drops the
narrative scaffolding around them. Models receive a denser, less ambiguous
brief, which means fewer corrective follow-ups and fewer retries.

---

## Built for Real-World Prompts

TokenSmoker is designed for the kind of prompts people actually paste into
production tools, not toy snippets. It handles:

- Multiline prompts
- Multi-task prompts that mix several surfaces or fixes
- Large coding prompts with stack traces, file paths, and constraints
- Large design prompts with per-component sections and asset lists
- Purchased design prompts (long, structured, narrative-heavy)
- Prompts with many components, assets, classes, icons, and animations

---

## Harness Architecture

Different prompt domains require different compilation strategies. A coding
prompt and a design prompt share almost no structure — the same compressor
serves both poorly. TokenSmoker dispatches each prompt to a domain-specific
*harness*.

| Harness | Purpose | Status |
|---|---|---|
| TS-Code | Coding prompts | Live |
| TS-Design | Website / UI design prompts | Live |
| TS-CAD | CAD / Fusion prompts | Planned |
| TS-Agent | Agent workflow prompts | Planned |
| TS-Research | Research / document prompts | Planned |

---

## Installation

```bash
npm install -g github:TokenSmoker/tokensmoker
```

This installs three equivalent binaries: `tokensmoker`, `tsm`, and `smoke`.

---

## Activation

```bash
tokensmoker activate
```

Activation asks for your name and email. Credentials are provisioned
automatically — there is no API key to copy, paste, or rotate by hand. The
trial is global per user, not per project.

```bash
tokensmoker status
```

Prints the activation state, plan, and trial days remaining.

---

## Harness Selection

Explicit harness selection is recommended whenever you know the domain. It
skips detection and produces deterministic output.

```bash
smoke code "paste or type your coding prompt here"

smoke design --paste

smoke design --file prompt.txt
```

If no harness is specified, TokenSmoker attempts automatic detection:

```bash
smoke "..."
```

Auto-detect currently supports **TS-Code** and **TS-Design**. As more
harnesses come online, the disambiguation cost of auto-detect grows —
explicit selection stays accurate as the matrix expands.

---

## Paste Workflow

For prompts longer than a single shell-friendly line, use `--paste`. This is
the recommended workflow for TS-Design, where prompts often run several
hundred lines.

```bash
smoke design --paste
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
smoke design --file prompt.txt
```

Or pipe directly:

```bash
cat prompt.txt | smoke design
```

---

## Example

A real Purchased User Prompt (PUP) — a long, narrative-heavy design brief
of the kind users buy or commission and paste in whole — shown as an excerpt:

```text
# Project Brief — DeFi Landing Page

We are building a premium DeFi landing page for institutional traders. The
page must convert technical decision-makers within 30 seconds. The aesthetic
should feel cinematic, dense, and high-trust.

## Stack
Use React, Vite, Tailwind CSS, Framer Motion, Lucide React, and shadcn/ui.

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

Reported savings:

```
Original: 5,016 chars (~1,254 tokens)
Compiled: 1,658 chars (~415 tokens)
Reduction: 66.9%
```

---

## Available Commands

```bash
tokensmoker activate          # provision credentials
tokensmoker status            # check plan and trial state

smoke "..."                   # auto-detect harness
smoke code "..."              # force TS-Code
smoke design --paste          # TS-Design, paste from terminal
smoke design --file prompt.txt   # TS-Design, read from file
```

`tsm` and `smoke` are aliases for `tokensmoker` — use whichever fits your
muscle memory.

### Legacy / Compatibility

```bash
tokensmoker compile "..."
tokensmoker compile design "..."
```

Still supported for older scripts. New work should use `smoke <harness>`
directly.

---

## Current Status

- **TS-Code**: live, deterministic, byte-stable across the harness router.
- **TS-Design**: live, component-line output, ~65% reduction on real PUPs.
- Active iteration on both harnesses.
- TS-CAD, TS-Agent, and TS-Research are planned.
