async function compile(userPrompt) {
  if (!userPrompt || !userPrompt.trim()) {
    console.error('Usage: tokensmoker compile "<prompt>"');
    process.exit(1);
  }

  const apiKey = process.env.TOKENSMOKER_API_KEY;
  if (!apiKey) {
    console.error("TokenSmoker API key missing. Set TOKENSMOKER_API_KEY.");
    process.exit(1);
  }

  const baseUrl =
    process.env.TOKENSMOKER_API_URL || "https://tokensmoker-api.onrender.com";

  let res;
  try {
    res = await fetch(`${baseUrl}/compile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ prompt: userPrompt })
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
  const diff = inputTokens - outputTokens;
  const absDiff = Math.abs(diff);
  const pct = inputTokens > 0
    ? Math.round((absDiff / inputTokens) * 100)
    : 0;
  const showPct = inputTokens >= 10;

  const label = diff >= 0 ? "Saved" : "Added";
  const diffLine = showPct
    ? `${label}:  ${absDiff} tokens (${pct}%)`
    : `${label}:  ${absDiff} tokens`;

  console.log("===== TOKENSMOKER COMPILED PROMPT =====");
  console.log("");
  console.log(data.compiledPrompt);
  console.log("");
  console.log("===== ESTIMATE =====");
  console.log(`Input:  ${inputTokens} tokens`);
  console.log(`Output: ${outputTokens} tokens`);
  if (diff >= 1) {
    console.log(diffLine);
    console.log("");
  }
  console.log("Additional savings likely due to fewer rework iterations.");
  console.log("");
  console.log("Copy the compiled prompt above into your AI coding tool.");
}

module.exports = compile;
