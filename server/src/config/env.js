import "dotenv/config";

function getSetting(key, fallback = undefined) {
  const value = process.env[key];
  return value !== undefined && value !== "" ? value : fallback;
}

function requireSetting(key) {
  const value = getSetting(key);
  if (value === undefined) {
    throw new Error(`Missing required setting: ${key}. Add it to .env.`);
  }
  return value;
}

export const config = {
  mongoUri: requireSetting("MONGO_URI"),
  dbName: getSetting("DB_NAME", "BuniyadBytePOC"),
  jwtSecret: requireSetting("JWT_SECRET"),
  port: Number(getSetting("PORT", "4000")),
  llm: {
    apiKey: requireSetting("LLM_API_KEY"),
    baseUrl: getSetting("LLM_BASE_URL", "https://openrouter.ai/api/v1/chat/completions"),
    model: getSetting("LLM_MODEL", "openai/gpt-4o-mini"),
  },
};
