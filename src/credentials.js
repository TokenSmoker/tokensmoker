const { getActivationData } = require("./status");

const ACTIVATION_GUIDANCE =
  "TokenSmoker is not activated. Run: smoke activate --email you@example.com";

function resolveApiKey({ readEnv, readActivation } = {}) {
  const envReader = readEnv || (() => process.env.TOKENSMOKER_API_KEY);
  const activationReader = readActivation || getActivationData;

  const envKey = envReader();
  if (typeof envKey === "string" && envKey.trim()) {
    return { apiKey: envKey.trim(), source: "env" };
  }

  const data = activationReader();
  if (data && typeof data.apiKey === "string" && data.apiKey.trim()) {
    return { apiKey: data.apiKey.trim(), source: "activation" };
  }

  return { apiKey: null, source: null, error: ACTIVATION_GUIDANCE };
}

module.exports = { resolveApiKey, ACTIVATION_GUIDANCE };
