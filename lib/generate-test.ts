import "server-only";

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, GENERATION_MODEL } from "./anthropic";
import { DIFFICULTY_DEFS } from "./difficulty";
import {
  GeneratedTestSchema,
  TOTAL_PREGUNTAS,
  validateInvariants,
  type Dificultad,
  type GeneratedTest,
} from "./test-contract";

const MAX_REINTENTOS = 3;

function construirPrompt(dificultad: Dificultad, feedback: string[]): string {
  const def = DIFFICULTY_DEFS[dificultad];
  const correccion = feedback.length
    ? `\n\nEn tu intento anterior hubo estos problemas. CORRÍGELOS en esta nueva versión:\n- ${feedback.join(
        "\n- ",
      )}`
    : "";

  return `Eres un experto redactor de preguntas tipo test para oposiciones españolas.

A partir EXCLUSIVAMENTE del temario adjunto (PDF), genera un test de EXACTAMENTE ${TOTAL_PREGUNTAS} preguntas.

Nivel de dificultad solicitado: ${def.label}.
${def.promptGuidance}

Reglas obligatorias:
- Exactamente ${TOTAL_PREGUNTAS} preguntas.
- Cada pregunta tiene EXACTAMENTE 4 opciones y SOLO UNA correcta.
- Las 4 opciones de una pregunta deben ser distintas entre sí.
- Básate ÚNICAMENTE en el contenido del temario. NO inventes datos que no estén en él.
- Para cada pregunta incluye "refTemario": un fragmento textual del temario que justifique la respuesta correcta (sirve de anclaje anti-alucinación).
- Para cada pregunta incluye "explicacion": por qué la opción correcta lo es.
- Varía la posición de la respuesta correcta entre las preguntas (no siempre la misma).
- No repitas enunciados.
- Redacta en el mismo idioma del temario.
- "descripcion": 1-2 frases que resuman de qué trata el temario.${correccion}`;
}

/**
 * Genera y valida un test a partir del PDF del temario.
 * Reintenta hasta MAX_REINTENTOS dándole a Claude el error concreto.
 * Lanza si no consigue un test válido.
 */
export async function generateTest(
  pdfBase64: string,
  dificultad: Dificultad,
): Promise<GeneratedTest> {
  let feedback: string[] = [];

  for (let intento = 1; intento <= MAX_REINTENTOS; intento++) {
    const response = await anthropic.messages.parse({
      model: GENERATION_MODEL,
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
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
            { type: "text", text: construirPrompt(dificultad, feedback) },
          ],
        },
      ],
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      feedback = [
        `La salida no cumplió el esquema (estructura o número de preguntas distinto de ${TOTAL_PREGUNTAS}).`,
      ];
      continue;
    }

    const errores = validateInvariants(parsed);
    if (errores.length === 0) return parsed;
    feedback = errores;
  }

  throw new Error(
    `No se pudo generar un test válido tras ${MAX_REINTENTOS} intentos. Últimos problemas: ${feedback.join(
      "; ",
    )}`,
  );
}
