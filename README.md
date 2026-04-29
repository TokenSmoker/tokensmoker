# TokenSmoker

Ship better code. Burn fewer tokens.

TokenSmoker compiles prompts for AI coding tools by selecting and structuring only the relevant project context for each request. The result is faster iteration cycles, lower token usage, and more reliable outputs.

---

## Why TokenSmoker

AI coding tools repeatedly send full context with every request.

That means:
- You pay for the same tokens over and over  
- Prompts get bloated and slow  
- Outputs drift and become inconsistent  

TokenSmoker replaces that with compiled prompts built from only what matters.

---

## Before / After

### Without TokenSmoker

```txt
"Here’s my entire project, previous prompts, and all related files...
[thousands of tokens repeated every request]"
```

### With TokenSmoker

```txt
"Here are the exact functions, files, and constraints relevant to this task."
```

Same task.  
Less noise.  
Better output.

---

## Benchmarks (early)

Across internal tests:

- 50–90% reduction in prompt size  
- Faster iteration cycles in multi-step tasks  
- More consistent outputs across repeated runs  

*(early data, expanding as usage grows)*

---

## What It Does

- Selects relevant project context per request  
- Removes repeated and unnecessary prompt data  
- Structures inputs for better model responses  
- Works as a lightweight CLI in your workflow  

---

## Who This Is For

TokenSmoker is built for developers who:

- Use AI coding tools daily (Cursor, Claude, GPT, etc.)  
- Hit token limits or slowdowns on real projects  
- Care about iteration speed and output quality  
- Want control over what the model actually sees  

---

## Install

```bash
npm install -g github:TokenSmoker/tokensmoker
```

---

## Quick Start

### 1. Activate

```bash
tokensmoker activate
```

Start your free trial.

---

### 2. Check Status

```bash
tokensmoker status
```

---

### 3. Run Compile

```bash
tokensmoker compile
```

---

## Trial

- 14-day free trial  
- No restrictions during trial period  
- Upgrade anytime  

---

## Upgrade

```bash
tokensmoker upgrade
```

Enter your commercial license key to unlock full access.

---

## How It Fits Your Workflow

```txt
Your Code → TokenSmoker → AI Model
```

Instead of sending everything, TokenSmoker sends only what’s needed.

---

## Notes

- Activation is global (per user, not per project)  
- No sensitive data is transmitted  
- License keys are stored in masked form  

---

## Version

v0.1.0-commercial

