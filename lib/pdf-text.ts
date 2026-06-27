import "server-only";

import { extractText, getDocumentProxy } from "unpdf";

/**
 * Extrae el texto de un PDF (en base64). DeepSeek no lee PDFs de forma nativa,
 * así que el temario se convierte a texto en servidor antes de mandarlo al
 * modelo. El PDF original NO se modifica: esto es una representación efímera.
 *
 * Lanza si el PDF no tiene texto extraíble (p. ej. escaneado sin OCR), para que
 * generateAction lo propague a la UI y limpie el PDF huérfano de Storage.
 */
export async function extraerTextoPdf(pdfBase64: string): Promise<string> {
  const bytes = Uint8Array.from(Buffer.from(pdfBase64, "base64"));
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  const limpio = text.trim();

  if (limpio.length < 20) {
    throw new Error(
      "No se pudo extraer texto del PDF (¿es un PDF escaneado?). DeepSeek necesita " +
        "texto seleccionable; usa un PDF con texto o cambia a LLM_PROVIDER=anthropic.",
    );
  }
  return limpio;
}

/**
 * Cuenta las páginas de un PDF (en base64). Se usa para bloquear temarios
 * demasiado largos antes de subirlos a Storage y de llamar al LLM.
 * Lanza si el PDF no se puede leer (corrupto / no es PDF).
 */
export async function contarPaginasPdf(pdfBase64: string): Promise<number> {
  const bytes = Uint8Array.from(Buffer.from(pdfBase64, "base64"));
  const pdf = await getDocumentProxy(bytes);
  return pdf.numPages;
}
