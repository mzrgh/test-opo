"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { generateTest } from "@/lib/generate-test";
import {
  insertTestWithQuestions,
  asignarEtiquetas,
  reemplazarEtiquetas,
} from "@/lib/db";
import { isGenerationConfigured } from "@/lib/provider";
import { validarEtiquetas, combinarEtiquetas } from "@/lib/etiquetas";
import { esGestor } from "@/lib/perfil";
import { contarPaginasPdf } from "@/lib/pdf-text";
import { APP_CONFIG, MAX_PDF_BYTES } from "@/lib/app-config";
import { supabase, isSupabaseConfigured, TEMARIOS_BUCKET } from "@/lib/supabase";
import { DIFFICULTIES, type Dificultad } from "@/lib/test-contract";

export interface GenerateState {
  error?: string;
  ok?: boolean;
}

/** Extrae etiquetas de un campo de texto separado por comas. */
function parseEtiquetas(valor: FormDataEntryValue | null): string[] {
  return String(valor ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function generateAction(
  _prev: GenerateState,
  formData: FormData,
): Promise<GenerateState> {
  // Perfil Estudiante: subir temarios está deshabilitado (blindaje en servidor).
  if (!esGestor()) {
    return { error: "Esta instancia no permite subir temarios (perfil Estudiante)." };
  }
  if (!isSupabaseConfigured || !isGenerationConfigured) {
    return {
      error:
        "Faltan credenciales en .env.local (Supabase y/o el proveedor de generación). Configúralas y reinicia el servidor.",
    };
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  const dificultad = String(formData.get("dificultad") ?? "") as Dificultad;
  const nivel = String(formData.get("nivel") ?? "").trim();
  const etiquetasLibres = parseEtiquetas(formData.get("etiquetas"));
  const file = formData.get("pdf");

  if (!nombre) return { error: "Indica un nombre para el temario." };
  if (!DIFFICULTIES.includes(dificultad)) {
    return { error: "Selecciona una dificultad válida." };
  }
  // Etiquetas: se valida ANTES de subir el PDF / generar para no dejar huérfanos.
  const errEtiquetas = validarEtiquetas(nivel, etiquetasLibres);
  if (errEtiquetas) return { error: errEtiquetas };
  const etiquetas = combinarEtiquetas(nivel, etiquetasLibres);
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Adjunta el PDF del temario." };
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { error: "El fichero debe ser un PDF." };
  }

  // Paso 1: tamaño del fichero subido (límite global en lib/app-config.ts).
  if (file.size > MAX_PDF_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      error: `El PDF pesa ${mb} MB y el máximo permitido es ${APP_CONFIG.maxPdfMB} MB. Reduce el tamaño o divídelo en partes.`,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const pdfBase64 = buffer.toString("base64");
  const pdfPath = `${randomUUID()}.pdf`;

  // Paso 2: nº de páginas (antes de subir a Storage y de llamar al LLM).
  let paginas: number;
  try {
    paginas = await contarPaginasPdf(pdfBase64);
  } catch {
    return { error: "No se pudo leer el PDF para contar sus páginas. ¿Está dañado?" };
  }
  if (paginas > APP_CONFIG.maxPdfPaginas) {
    return {
      error: `El temario tiene ${paginas} páginas y el máximo es ${APP_CONFIG.maxPdfPaginas}. Divídelo en partes más pequeñas.`,
    };
  }

  // 1) Subir el PDF a Storage.
  const { error: uploadErr } = await supabase.storage
    .from(TEMARIOS_BUCKET)
    .upload(pdfPath, buffer, { contentType: "application/pdf", upsert: false });
  if (uploadErr) {
    return { error: `No se pudo subir el PDF: ${uploadErr.message}` };
  }

  // 2) Generar el test (paso caro y arriesgado) ANTES de tocar la BD.
  let generated;
  try {
    generated = await generateTest(pdfBase64, dificultad);
  } catch (e) {
    // Limpieza: borra el PDF huérfano si la generación falla.
    await supabase.storage.from(TEMARIOS_BUCKET).remove([pdfPath]);
    return {
      error: e instanceof Error ? e.message : "Error generando el test.",
    };
  }

  // 3) Persistir temario + test + preguntas.
  const { data: subject, error: subErr } = await supabase
    .from("subjects")
    .insert({ nombre, descripcion: generated.descripcion, pdf_path: pdfPath })
    .select("id")
    .single();
  if (subErr || !subject) {
    await supabase.storage.from(TEMARIOS_BUCKET).remove([pdfPath]);
    return { error: `Error guardando el temario: ${subErr?.message}` };
  }

  // Etiquetas: crea las que falten y las vincula. Si falla, deshace el temario
  // y el PDF para no dejar estado inconsistente.
  try {
    await asignarEtiquetas(subject.id, etiquetas);
  } catch (e) {
    await supabase.storage.from(TEMARIOS_BUCKET).remove([pdfPath]);
    await supabase.from("subjects").delete().eq("id", subject.id);
    return {
      error: e instanceof Error ? e.message : "Error guardando las etiquetas.",
    };
  }

  let testId: string;
  try {
    testId = await insertTestWithQuestions(subject.id, dificultad, generated);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error guardando el test." };
  }

  revalidatePath("/");
  redirect(`/tests/${testId}`);
}

/**
 * Genera un test nuevo a partir de un temario YA existente: descarga su PDF de
 * Storage (no se re-sube) y reutiliza el mismo flujo de generación.
 */
export async function generateFromSubjectAction(
  _prev: GenerateState,
  formData: FormData,
): Promise<GenerateState> {
  if (!isSupabaseConfigured || !isGenerationConfigured) {
    return {
      error:
        "Faltan credenciales en .env.local (Supabase y/o el proveedor de generación). Configúralas y reinicia el servidor.",
    };
  }

  const subjectId = String(formData.get("subjectId") ?? "").trim();
  const dificultad = String(formData.get("dificultad") ?? "") as Dificultad;

  if (!subjectId) return { error: "Temario no válido." };
  if (!DIFFICULTIES.includes(dificultad)) {
    return { error: "Selecciona una dificultad válida." };
  }

  const { data: subject, error: subErr } = await supabase
    .from("subjects")
    .select("pdf_path")
    .eq("id", subjectId)
    .maybeSingle();
  if (subErr) return { error: `Error leyendo el temario: ${subErr.message}` };
  const pdfPath = (subject as { pdf_path: string | null } | null)?.pdf_path;
  if (!pdfPath) {
    return { error: "Este temario no tiene un PDF asociado." };
  }

  const { data: blob, error: dlErr } = await supabase.storage
    .from(TEMARIOS_BUCKET)
    .download(pdfPath);
  if (dlErr || !blob) {
    return { error: `No se pudo leer el PDF del temario: ${dlErr?.message}` };
  }
  const pdfBase64 = Buffer.from(await blob.arrayBuffer()).toString("base64");

  // Paso 2: nº de páginas (el límite puede haber cambiado desde que se subió).
  try {
    const paginas = await contarPaginasPdf(pdfBase64);
    if (paginas > APP_CONFIG.maxPdfPaginas) {
      return {
        error: `El temario tiene ${paginas} páginas y el máximo es ${APP_CONFIG.maxPdfPaginas}. No se puede generar.`,
      };
    }
  } catch {
    return { error: "No se pudo leer el PDF del temario para contar sus páginas." };
  }

  let generated;
  try {
    generated = await generateTest(pdfBase64, dificultad);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error generando el test." };
  }

  let testId: string;
  try {
    testId = await insertTestWithQuestions(subjectId, dificultad, generated);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error guardando el test." };
  }

  revalidatePath(`/temarios/${subjectId}`);
  revalidatePath("/");
  redirect(`/tests/${testId}`);
}

/**
 * Reemplaza las etiquetas de un temario existente (edición desde /temarios/[id]).
 * No genera nada; solo actualiza el etiquetado.
 */
export async function updateSubjectEtiquetasAction(
  _prev: GenerateState,
  formData: FormData,
): Promise<GenerateState> {
  // Perfil Estudiante: gestionar etiquetas está deshabilitado (blindaje en servidor).
  if (!esGestor()) {
    return { error: "Esta instancia no permite editar etiquetas (perfil Estudiante)." };
  }
  if (!isSupabaseConfigured) {
    return { error: "Falta configuración de Supabase en .env.local." };
  }

  const subjectId = String(formData.get("subjectId") ?? "").trim();
  if (!subjectId) return { error: "Temario no válido." };

  const nivel = String(formData.get("nivel") ?? "").trim();
  const etiquetasLibres = parseEtiquetas(formData.get("etiquetas"));
  const errEtiquetas = validarEtiquetas(nivel, etiquetasLibres);
  if (errEtiquetas) return { error: errEtiquetas };
  const etiquetas = combinarEtiquetas(nivel, etiquetasLibres);
  try {
    await reemplazarEtiquetas(subjectId, etiquetas);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Error actualizando las etiquetas.",
    };
  }

  revalidatePath(`/temarios/${subjectId}`);
  revalidatePath("/temarios");
  return { ok: true };
}
