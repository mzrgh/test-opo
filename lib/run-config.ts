import "server-only";

/**
 * Configuración de la pantalla de ejecución (fuente única).
 *
 * QUESTION_UNLOCK_SECONDS (env, opcional): segundos que permanecen bloqueadas
 * las opciones y "Marcar para revisión" cada vez que se muestra una pregunta,
 * para obligar a leer el enunciado. Default 20. `0` (o negativo/ inválido → se
 * normaliza) desactiva el bloqueo. Server-only: el valor llega al cliente como
 * prop desde el server component (misma técnica que lib/perfil.ts).
 */
const DEFAULT_UNLOCK_SECONDS = 20;

export function getSegundosBloqueoPregunta(): number {
  const raw = process.env.QUESTION_UNLOCK_SECONDS;
  if (raw === undefined || raw.trim() === "") return DEFAULT_UNLOCK_SECONDS;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return DEFAULT_UNLOCK_SECONDS;
  return Math.max(0, n);
}
