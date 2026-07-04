import "server-only";

import { generationProvider } from "./provider";
import { extraerTextoPdf } from "./pdf-text";
import { DIFFICULTY_DEFS } from "./difficulty";
import {
  GeneratedTestSchema,
  MIN_PREGUNTAS,
  OPCIONES_POR_PREGUNTA,
  TOTAL_PREGUNTAS,
  validateInvariants,
  type Dificultad,
  type GeneratedQuestion,
  type GeneratedTest,
} from "./test-contract";

const MAX_REINTENTOS = 3;

/** Fisher–Yates. Servidor: Math.random es aceptable (no hay requisito criptográfico). */
function barajar<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Reparte la posición de la respuesta correcta equitativamente entre A/B/C/D y
 * baraja el resto de opciones. Elimina de raíz el sesgo del modelo a concentrar
 * la correcta en una letra (típicamente la B). Determinista en distribución
 * (~10 por letra en 40 preguntas), 0 coste de tokens.
 *
 * Requisito: las opciones NO deben ser auto-referenciales por posición (se
 * prohíbe en el prompt y lo verifica validateInvariants antes de llegar aquí).
 */
function equilibrarRespuestas(
  preguntas: GeneratedQuestion[],
): GeneratedQuestion[] {
  // Bolsa balanceada de índices objetivo (0,1,2,3,0,1,2,3,…) barajada.
  const objetivos = barajar(
    preguntas.map((_, i) => i % OPCIONES_POR_PREGUNTA),
  );

  return preguntas.map((q, i) => {
    const destino = objetivos[i];
    const correcta = q.opciones[q.indiceCorrecta];
    const otras = barajar(
      q.opciones.filter((_, idx) => idx !== q.indiceCorrecta),
    );
    let k = 0;
    const opciones = q.opciones.map((_, pos) =>
      pos === destino ? correcta : otras[k++],
    );
    return { ...q, opciones, indiceCorrecta: destino };
  });
}

function construirPrompt(
  dificultad: Dificultad,
  feedback: string[],
  temarioTexto: string | null,
): string {
  const def = DIFFICULTY_DEFS[dificultad];
  const correccion = feedback.length
    ? `\n\nEn tu intento anterior hubo estos problemas. CORRÍGELOS en esta nueva versión:\n- ${feedback.join(
        "\n- ",
      )}`
    : "";

  // El proveedor que no lee PDFs (DeepSeek) recibe el temario como texto y
  // necesita un ejemplo explícito del JSON de salida (modo json_object).
  const fuente = temarioTexto
    ? `el siguiente temario (texto extraído del PDF):\n\n"""\n${temarioTexto}\n"""`
    : "el temario adjunto (PDF)";

  const formatoJson = temarioTexto
    ? `\n\nResponde EXCLUSIVAMENTE con un objeto JSON válido (sin texto adicional ni markdown) con esta forma exacta:
{
  "descripcion": "string (1-2 frases)",
  "preguntas": [
    {
      "enunciado": "string",
      "opciones": ["opción A", "opción B", "opción C", "opción D"],
      "indiceCorrecta": 0,
      "explicacion": "string",
      "refTemario": "string"
    }
  ]
}`
    : "";

  return `Eres un experto redactor de preguntas tipo test para oposiciones españolas.

A partir EXCLUSIVAMENTE de ${fuente}, genera un test de EXACTAMENTE ${TOTAL_PREGUNTAS} preguntas.

Nivel de dificultad solicitado: ${def.label}.
${def.promptGuidance}

Reglas obligatorias:
- Exactamente ${TOTAL_PREGUNTAS} preguntas.
- Cada pregunta tiene EXACTAMENTE 4 opciones y SOLO UNA correcta.
- Las 4 opciones de una pregunta deben ser distintas entre sí.
- Cada opción debe ser INDEPENDIENTE y autocontenida. PROHIBIDO usar opciones que se refieran a otras por su posición o letra, como "Todas las anteriores", "Ninguna de las anteriores", "Las respuestas a) y c) son correctas" o similares (el orden de las opciones se reordena después, así que romperían la pregunta).
- Básate ÚNICAMENTE en el contenido del temario. NO inventes datos que no estén en él.
- Para cada pregunta incluye "refTemario": un fragmento textual del temario que justifique la respuesta correcta (sirve de anclaje anti-alucinación).
- Para cada pregunta incluye "explicacion": por qué la opción correcta lo es.
- No repitas enunciados.
- Redacta en el mismo idioma del temario.
- "descripcion": 1-2 frases que resuman de qué trata el temario.

Estilo (examen oficial de oposición española):
- Enunciados formales, precisos y de una sola idea; sin ambigüedades ni "trucos" gramaticales.
- Cuando el temario cite normativa, formula al estilo oficial ("De conformidad con lo dispuesto en el art. X de la Ley .../ de la Constitución Española, …"), SOLO si el artículo/dato figura en el temario (nunca lo inventes).
- Combina tipos de pregunta: definiciones y conceptos directos ("Una sede electrónica es:"), y supuestos prácticos ("¿Qué ocurre si un usuario tiene permiso de Lectura a nivel de recurso y Modificación a nivel NTFS?").
- Distractores plausibles pero inequívocamente incorrectos, homogéneos con la opción correcta en longitud, registro y formato (no hagas la correcta más larga o más detallada que las demás).
- No repitas literalmente frases del temario como enunciado: reformula.${correccion}${formatoJson}`;
}

/**
 * Genera y valida un test a partir del PDF del temario.
 * Reintenta hasta MAX_REINTENTOS dándole al modelo el error concreto.
 * Lanza si no consigue un test válido (o si el PDF no tiene texto extraíble
 * cuando el proveedor activo lo requiere).
 */
export async function generateTest(
  pdfBase64: string,
  dificultad: Dificultad,
): Promise<GeneratedTest> {
  let feedback: string[] = [];

  // DeepSeek no lee PDFs: extraemos el texto UNA sola vez antes del loop. Si el
  // PDF no tiene texto (escaneado), esto lanza y aborta la generación.
  const temarioTexto = generationProvider.requiereTextoPlano
    ? await extraerTextoPdf(pdfBase64)
    : null;

  for (let intento = 1; intento <= MAX_REINTENTOS; intento++) {
    let parsed: GeneratedTest | null = null;
    try {
      const obj = await generationProvider.generarObjeto({
        prompt: construirPrompt(dificultad, feedback, temarioTexto),
        pdfBase64,
        temarioTexto,
      });
      const res = GeneratedTestSchema.safeParse(obj);
      if (!res.success) {
        feedback = [
          `La salida no cumplió el esquema requerido: ${res.error.message}. Devuelve exactamente ${TOTAL_PREGUNTAS} preguntas con la estructura pedida.`,
        ];
        continue;
      }
      parsed = res.data;
    } catch (e) {
      // El modelo falló o devolvió algo no parseable: reintentamos con feedback.
      feedback = [
        `La salida no se pudo parsear: ${
          e instanceof Error ? e.message : String(e)
        }. Devuelve exactamente ${TOTAL_PREGUNTAS} preguntas con la estructura pedida.`,
      ];
      continue;
    }

    // Normalizar el conteo: recorta si pasa de TOTAL; reintenta solo si no
    // llega al mínimo aceptable (MIN_PREGUNTAS).
    if (parsed.preguntas.length > TOTAL_PREGUNTAS) {
      parsed = {
        ...parsed,
        preguntas: parsed.preguntas.slice(0, TOTAL_PREGUNTAS),
      };
    } else if (parsed.preguntas.length < MIN_PREGUNTAS) {
      feedback = [
        `Devolviste ${parsed.preguntas.length} preguntas; necesito al menos ${MIN_PREGUNTAS} (idealmente ${TOTAL_PREGUNTAS}).`,
      ];
      continue;
    }

    const errores = validateInvariants(parsed);
    if (errores.length === 0) {
      // Reparte la respuesta correcta entre A/B/C/D (anti-sesgo del modelo).
      return {
        ...parsed,
        preguntas: equilibrarRespuestas(parsed.preguntas),
      };
    }
    feedback = errores;
  }

  throw new Error(
    `No se pudo generar un test válido tras ${MAX_REINTENTOS} intentos. Últimos problemas: ${feedback.join(
      "; ",
    )}`,
  );
}
