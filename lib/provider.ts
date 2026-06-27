import "server-only";

import type OpenAI from "openai";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, GENERATION_MODEL, isAnthropicConfigured } from "./anthropic";
import { deepseek, DEEPSEEK_MODEL, isDeepseekConfigured } from "./deepseek";
import { zai, ZAI_MODEL, isZaiConfigured } from "./zai";
import { GeneratedTestSchema } from "./test-contract";

export type ProviderId = "anthropic" | "deepseek" | "zai";

/** Proveedor de generación activo. Conmutable sin tocar código. */
export const LLM_PROVIDER = (process.env.LLM_PROVIDER ?? "anthropic") as ProviderId;

interface GenerarParams {
  /** Prompt ya construido (incluye el temario en texto si el proveedor lo requiere). */
  prompt: string;
  /** PDF en base64 (lo usa el proveedor que lee PDFs de forma nativa). */
  pdfBase64: string;
  /** Texto del temario ya extraído (para proveedores que no leen PDFs). */
  temarioTexto: string | null;
}

interface GenerationProvider {
  id: ProviderId;
  label: string;
  /** El modelo no lee PDFs: hay que extraer el texto antes y pasarlo en el prompt. */
  requiereTextoPlano: boolean;
  isConfigured: boolean;
  /** Devuelve el objeto crudo del modelo; la validación Zod la hace generate-test.ts. */
  generarObjeto(params: GenerarParams): Promise<unknown>;
}

const anthropicProvider: GenerationProvider = {
  id: "anthropic",
  label: `Anthropic (${GENERATION_MODEL})`,
  requiereTextoPlano: false,
  isConfigured: isAnthropicConfigured,
  async generarObjeto({ prompt, pdfBase64 }) {
    // Haiku 4.5 no admite adaptive thinking ni output_config.effort.
    const soportaThinking = !GENERATION_MODEL.includes("haiku");
    const response = await anthropic.messages.parse({
      model: GENERATION_MODEL,
      max_tokens: 32000,
      ...(soportaThinking ? { thinking: { type: "adaptive" as const } } : {}),
      output_config: {
        ...(soportaThinking ? { effort: "high" as const } : {}),
        format: zodOutputFormat(GeneratedTestSchema),
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });
    return response.parsed_output;
  },
};

/**
 * Proveedores compatibles con OpenAI (DeepSeek, z.ai/GLM): no leen PDFs, reciben
 * el temario como texto en el prompt y devuelven JSON con response_format.
 */
function openAiCompatProvider(opts: {
  id: ProviderId;
  label: string;
  client: OpenAI;
  model: string;
  isConfigured: boolean;
}): GenerationProvider {
  return {
    id: opts.id,
    label: opts.label,
    requiereTextoPlano: true,
    isConfigured: opts.isConfigured,
    async generarObjeto({ prompt }) {
      const completion = await opts.client.chat.completions.create({
        model: opts.model,
        max_tokens: 32000,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      });
      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error(`${opts.label} devolvió una respuesta vacía.`);
      return JSON.parse(content);
    },
  };
}

const deepseekProvider = openAiCompatProvider({
  id: "deepseek",
  label: `DeepSeek (${DEEPSEEK_MODEL})`,
  client: deepseek,
  model: DEEPSEEK_MODEL,
  isConfigured: isDeepseekConfigured,
});

const zaiProvider = openAiCompatProvider({
  id: "zai",
  label: `z.ai (${ZAI_MODEL})`,
  client: zai,
  model: ZAI_MODEL,
  isConfigured: isZaiConfigured,
});

const PROVIDERS: Record<ProviderId, GenerationProvider> = {
  anthropic: anthropicProvider,
  deepseek: deepseekProvider,
  zai: zaiProvider,
};

export const generationProvider: GenerationProvider =
  PROVIDERS[LLM_PROVIDER] ?? anthropicProvider;

/** ¿Está configurado el proveedor de generación activo? */
export const isGenerationConfigured = generationProvider.isConfigured;
