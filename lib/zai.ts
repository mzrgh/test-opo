import OpenAI from "openai";

const apiKey = process.env.ZAI_API_KEY;

/** ¿Hay una API key real de z.ai configurada? (no tiene prefijo fijo) */
export const isZaiConfigured = !!apiKey && apiKey.length > 10 && !apiKey.includes("...");

// API compatible con OpenAI (z.ai / GLM). timeout amplio: generar 40 preguntas tarda.
export const zai = new OpenAI({
  apiKey: apiKey ?? "placeholder",
  baseURL: "https://api.z.ai/api/paas/v4",
  timeout: 10 * 60 * 1000,
});

// Modelo por defecto: GLM-4.7-FlashX (200K de contexto, 128K de salida, modo JSON).
export const ZAI_MODEL = process.env.ZAI_MODEL ?? "glm-4.7-flashx";
