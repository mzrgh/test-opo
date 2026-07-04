// Contrato de generación: lo que devuelve Claude.
// OJO: aquí NO van id, dificultad ni fecha. Esos los pone el servidor
// (fuente de verdad fiable). Claude solo produce lo que requiere leer el PDF.

import { z } from "zod/v4";

export const DIFFICULTIES = ["baja", "media", "alta"] as const;
export type Dificultad = (typeof DIFFICULTIES)[number];
export const DificultadSchema = z.enum(DIFFICULTIES);

export const TOTAL_PREGUNTAS = 40; // objetivo: lo que se le pide al modelo
export const MIN_PREGUNTAS = 35; // mínimo aceptable para dar el test por válido
export const OPCIONES_POR_PREGUNTA = 4;

export const GeneratedQuestionSchema = z.object({
  enunciado: z.string().min(1).describe("Enunciado de la pregunta."),
  opciones: z
    .array(z.string().min(1))
    .length(OPCIONES_POR_PREGUNTA)
    .describe("Exactamente 4 opciones de respuesta, sin duplicados."),
  indiceCorrecta: z
    .number()
    .int()
    .min(0)
    .max(3)
    .describe("Índice (0-3) de la opción correcta dentro de 'opciones'."),
  explicacion: z
    .string()
    .min(1)
    .describe("Por qué la opción correcta es correcta."),
  refTemario: z
    .string()
    .min(1)
    .describe("Fragmento del temario que justifica la respuesta (anti-alucinación)."),
});
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

export const GeneratedTestSchema = z.object({
  descripcion: z
    .string()
    .min(1)
    .describe("1-2 frases que describen el contenido del temario."),
  // Sin tope exacto a propósito: algunos modelos (p. ej. Haiku) ignoran el
  // maxItems y devuelven 41+, lo que haría fallar el parseo entero. El conteo
  // exacto (40) se normaliza/valida en código (generate-test.ts + invariantes).
  preguntas: z
    .array(GeneratedQuestionSchema)
    .min(1)
    .describe(`Idealmente ${TOTAL_PREGUNTAS} preguntas.`),
});
export type GeneratedTest = z.infer<typeof GeneratedTestSchema>;

/**
 * Detecta opciones auto-referenciales por posición ("a y c son correctas",
 * "todas las anteriores", "ninguna de las anteriores"…). Estas rompen el
 * barajado de opciones que hace el servidor (equilibrarRespuestas), por eso se
 * prohíben en el prompt y se fuerza reintento si el modelo las cuela.
 */
const PATRONES_AUTOREFERENCIA = [
  /\b(todas|ninguna)\s+(las\s+)?(de\s+las\s+)?(anteriores|dem[aá]s|opciones|respuestas)/i,
  /\brespuestas?\s+[a-d]\)?\s*(y|,|o|\/)\s*[a-d]\)?/i,
  /\b[a-d]\)?\s*(y|,)\s*[a-d]\)?\s+son\s+correctas/i,
  /\bson\s+correctas\b/i,
];

function esAutoReferencia(opcion: string): boolean {
  return PATRONES_AUTOREFERENCIA.some((re) => re.test(opcion));
}

/**
 * Invariantes que el esquema Zod/JSON no captura del todo (chequeos cruzados).
 * Devuelve la lista de errores legibles; vacía = test válido.
 */
export function validateInvariants(test: GeneratedTest): string[] {
  const errores: string[] = [];

  if (test.preguntas.length < MIN_PREGUNTAS) {
    errores.push(
      `Se necesitan al menos ${MIN_PREGUNTAS} preguntas y llegaron ${test.preguntas.length}.`,
    );
  }

  const enunciadosVistos = new Set<string>();
  test.preguntas.forEach((q, i) => {
    const n = i + 1;
    if (q.opciones.length !== OPCIONES_POR_PREGUNTA) {
      errores.push(`Pregunta ${n}: debe tener exactamente 4 opciones.`);
    }
    if (new Set(q.opciones).size !== q.opciones.length) {
      errores.push(`Pregunta ${n}: tiene opciones duplicadas.`);
    }
    if (q.indiceCorrecta < 0 || q.indiceCorrecta >= q.opciones.length) {
      errores.push(`Pregunta ${n}: indiceCorrecta fuera de rango.`);
    }
    if (q.opciones.some(esAutoReferencia)) {
      errores.push(
        `Pregunta ${n}: contiene opciones auto-referenciales por posición ("a y c son correctas", "todas las anteriores"…). Redáctala con 4 opciones independientes y autocontenidas.`,
      );
    }
    const clave = q.enunciado.trim().toLowerCase();
    if (enunciadosVistos.has(clave)) {
      errores.push(`Pregunta ${n}: enunciado duplicado.`);
    }
    enunciadosVistos.add(clave);
  });

  return errores;
}
