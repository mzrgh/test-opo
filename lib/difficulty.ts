// Fuente ÚNICA de la definición de dificultad.
// Lo que se muestra al usuario (description) y lo que se le pide a Claude
// (promptGuidance) salen de aquí, así nunca divergen (HU-05 ↔ HU-04).

import type { Dificultad } from "./test-contract";

export interface DifficultyDef {
  value: Dificultad;
  label: string;
  /** Texto para la UI: qué implica este nivel para el opositor. */
  description: string;
  /** Instrucción inyectada en el prompt de generación. */
  promptGuidance: string;
}

export const DIFFICULTY_DEFS: Record<Dificultad, DifficultyDef> = {
  baja: {
    value: "baja",
    label: "Baja",
    description:
      "Preguntas directas sobre definiciones, conceptos y datos explícitos del temario. Ideal para una primera pasada o memorización.",
    promptGuidance:
      "Nivel BAJO: preguntas directas sobre definiciones, conceptos clave y datos que aparecen explícitamente en el temario. Distractores claramente diferenciables. Evita matices y casos límite.",
  },
  media: {
    value: "media",
    label: "Media",
    description:
      "Mezcla de recuerdo y comprensión: relacionar conceptos, aplicar reglas a casos sencillos y distinguir matices.",
    promptGuidance:
      "Nivel MEDIO: combina recuerdo y comprensión. Incluye preguntas que exigen relacionar conceptos, aplicar reglas a casos sencillos y distinguir entre opciones parecidas. Distractores plausibles pero distinguibles con buen estudio.",
  },
  alta: {
    value: "alta",
    label: "Alta",
    description:
      "Preguntas exigentes: supuestos prácticos, excepciones, matices finos y distractores muy plausibles. Simula el nivel real del examen.",
    promptGuidance:
      "Nivel ALTO: preguntas exigentes tipo examen real. Incluye supuestos prácticos, excepciones, plazos/cifras concretas y matices finos. Distractores muy plausibles que requieren dominio del temario. Penaliza la respuesta superficial.",
  },
};

export const DIFFICULTY_LIST: DifficultyDef[] = [
  DIFFICULTY_DEFS.baja,
  DIFFICULTY_DEFS.media,
  DIFFICULTY_DEFS.alta,
];
