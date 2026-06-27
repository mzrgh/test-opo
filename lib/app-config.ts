/**
 * Parámetros globales de la aplicación (NO son secretos: no usar variables de
 * entorno). Edita aquí para cambiar los límites; es la fuente única.
 *
 * Seguro de importar tanto en servidor como en cliente (no lleva "server-only").
 */
export const APP_CONFIG = {
  /** Paso 1: tamaño máximo (MB) del PDF de temario que se puede subir. */
  maxPdfMB: 10,
  /** Paso 2: nº máximo de páginas del PDF que se enviarán al LLM. */
  maxPdfPaginas: 50,
} as const;

/**
 * Tamaño máximo en bytes, derivado de maxPdfMB.
 * OJO: si subes maxPdfMB por encima de ~14, sube también
 * `experimental.serverActions.bodySizeLimit` en next.config.mjs (hoy 15 MB),
 * o Next rechazará la subida antes de llegar a la Server Action.
 */
export const MAX_PDF_BYTES = APP_CONFIG.maxPdfMB * 1024 * 1024;
