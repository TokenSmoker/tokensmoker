const { resolveApiKey } = require("./credentials");
const { renderCompileSummary } = require("./render");
const { refreshAccountState } = require("./accountState");

async function compile(userPrompt, opts = {}) {
  if (!userPrompt || !userPrompt.trim()) {
    console.error('Usage: tokensmoker compile "<prompt>"');
    process.exit(1);
  }

  const harness = opts.harness || "auto";
  const debug = !!opts.debug;

  const { apiKey, error } = resolveApiKey();
  if (!apiKey) {
    console.error(error);
    process.exit(1);
  }

  const baseUrl =
    process.env.TOKENSMOKER_API_URL || "https://tokensmoker-api.onrender.com";

  // Refresh local account state from the server before each compile so that
  // post-payment status (and any plan transitions) take effect without the
  // user having to re-run `smoke activate`. Network/cache failures fall
  // through to the existing /compile auth check — we never block compile on
  // refresh alone.
  const refresh = await refreshAccountState({
    apiKey,
    baseUrl,
    fetchFn: globalThis.fetch
  });
  if (!refresh.ok && refresh.status === "unauthorized") {
    console.error("TokenSmoker activation needs to be refreshed.");
    console.error("Run: smoke activate --email you@example.com");
    process.exit(1);
  }

  let res;
  try {
    res = await fetch(`${baseUrl}/compile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ prompt: userPrompt, harness, debug })
    });
  } catch (err) {
    console.error(`Request failed: ${err.message}`);
    process.exit(1);
  }

  if (!res.ok) {
    let message = `Request failed: ${res.status} ${res.statusText}`;

    try {
      const data = await res.json();
      if (data?.error) {
        message = data.error === "Trial expired"
          ? "Free trial expired"
          : data.error;
      }
    } catch (_) {}

    console.error(message);
    process.exit(1);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    console.error("Invalid response: not JSON");
    process.exit(1);
  }

  if (typeof data.compiledPrompt !== "string") {
    console.error("Invalid response: missing compiledPrompt");
    process.exit(1);
  }

  const inputTokens = Math.ceil(userPrompt.length / 4);
  const outputTokens = Math.ceil(data.compiledPrompt.length / 4);

  const usedHarness = typeof data.harness === "string" ? data.harness : harness;
  const headerSuffix = usedHarness ? ` (harness: ${usedHarness})` : "";
  console.log(`===== TOKENSMOKER COMPILED PROMPT${headerSuffix} =====`);
  // Version markers — proves which compiler the deployed API ran. If this
  // doesn't show v0.6.2 / component-scoped, the API is stale or the CLI is
  // hitting the wrong URL (check $TOKENSMOKER_API_URL).
  if (data.compilerVersion || data.designCompilerMode || data.gitCommit) {
    const parts = [];
    if (data.compilerVersion) parts.push(`compiler v${data.compilerVersion}`);
    if (data.designCompilerMode) parts.push(`design: ${data.designCompilerMode}`);
    if (data.gitCommit) parts.push(`commit ${data.gitCommit}`);
    console.log(parts.join(" | "));
  }
  console.log("");
  console.log(data.compiledPrompt);
  console.log("");

  if (debug && data.debug) {
    console.log("===== DEBUG =====");
    const d = data.debug;
    console.log(`compilerVersion:    ${d.compilerVersion}`);
    console.log(`designCompilerMode: ${d.designCompilerMode}`);
    console.log(`rendererBranch:     ${d.rendererBranch}`);
    if (Array.isArray(d.components) && d.components.length) {
      console.log("components:");
      for (const c of d.components) {
        console.log(`  - ${c.name} (${c.kind})`);
      }
    }
    if (d.chunkOwnership && Object.keys(d.chunkOwnership).length) {
      console.log("chunkOwnership (heading-form chunk byte length):");
      for (const [k, v] of Object.entries(d.chunkOwnership)) {
        console.log(`  - ${k}: ${v}`);
      }
    } else {
      console.log("chunkOwnership: (none — no heading-form sections detected)");
    }
    if (d.componentAtomCounts && Object.keys(d.componentAtomCounts).length) {
      console.log("componentAtomCounts:");
      for (const [name, counts] of Object.entries(d.componentAtomCounts)) {
        const parts = Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(" ");
        console.log(`  - ${name}: ${parts}`);
      }
    }
    if (d.globalFallbackAtomCounts) {
      const parts = Object.entries(d.globalFallbackAtomCounts)
        .map(([k, v]) => `${k}=${v}`).join(" ");
      console.log(`globalFallbackAtomCounts: ${parts}`);
    }
    console.log("");
  }

  // Compile summary — primary value framing is "what improved" + "likely
  // outcome", with token delta as a secondary "Prompt delta" line. Token
  // increases never render as "Added: -X"; they show as preservation-first
  // compiles. See src/render.js for the rendering rules.
  console.log(renderCompileSummary({
    inputTokens,
    outputTokens,
    harness: usedHarness,
  }));
  console.log("");
  console.log("Copy the compiled prompt above into your AI coding tool.");
}

module.exports = compile;
