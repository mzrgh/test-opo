import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;

/** ¿Hay una API key real de Anthropic configurada? */
export const isAnthropicConfigured = !!apiKey && apiKey.startsWith("sk-ant-");

// timeout amplio: generar 40 preguntas de calidad puede tardar varios minutos.
export const anthropic = new Anthropic({
  apiKey: apiKey ?? "placeholder",
  timeout: 10 * 60 * 1000,
});

// Modelo configurable. Por defecto el Opus más capaz (calidad en oposiciones).
export const GENERATION_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";
