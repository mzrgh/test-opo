import OpenAI from "openai";

const apiKey = process.env.DEEPSEEK_API_KEY;

/** ¿Hay una API key real de DeepSeek configurada? */
export const isDeepseekConfigured = !!apiKey && apiKey.startsWith("sk-");

// API compatible con OpenAI. timeout amplio: generar 40 preguntas puede tardar.
export const deepseek = new OpenAI({
  apiKey: apiKey ?? "placeholder",
  baseURL: "https://api.deepseek.com",
  timeout: 10 * 60 * 1000,
});

// Modelo configurable. Por defecto v4-flash (1M de contexto, 384K de salida,
// modo JSON). NO usar deepseek-chat/deepseek-reasoner: se deprecan el 2026/07/24.
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
