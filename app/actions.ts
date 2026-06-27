"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { generateTest } from "@/lib/generate-test";
import { insertTestWithQuestions } from "@/lib/db";
import { isGenerationConfigured } from "@/lib/provider";
import { supabase, isSupabaseConfigured, TEMARIOS_BUCKET } from "@/lib/supabase";
import { DIFFICULTIES, type Dificultad } from "@/lib/test-contract";

export interface GenerateState {
  error?: string;
}

export async function generateAction(
  _prev: GenerateState,
  formData: FormData,
): Promise<GenerateState> {
  if (!isSupabaseConfigured || !isGenerationConfigured) {
    return {
      error:
        "Faltan credenciales en .env.local (Supabase y/o el proveedor de generación). Configúralas y reinicia el servidor.",
    };
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  const dificultad = String(formData.get("dificultad") ?? "") as Dificultad;
  const file = formData.get("pdf");

  if (!nombre) return { error: "Indica un nombre para el temario." };
  if (!DIFFICULTIES.includes(dificultad)) {
    return { error: "Selecciona una dificultad válida." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Adjunta el PDF del temario." };
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { error: "El fichero debe ser un PDF." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const pdfBase64 = buffer.toString("base64");
  const pdfPath = `${randomUUID()}.pdf`;

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
