"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * Crea un intento nuevo para un test y pre-crea sus filas de answers (una por
 * pregunta), de modo que cada respuesta posterior sea un UPDATE simple y se
 * pueda reanudar el test aunque se cierre el navegador.
 */
export async function startAttempt(testId: string): Promise<void> {
  const { data: attempt, error: aErr } = await supabase
    .from("attempts")
    .insert({ test_id: testId })
    .select("id")
    .single();
  if (aErr || !attempt) {
    throw new Error(`No se pudo iniciar el intento: ${aErr?.message}`);
  }

  const { data: questions, error: qErr } = await supabase
    .from("questions")
    .select("id")
    .eq("test_id", testId);
  if (qErr) throw new Error(qErr.message);

  const filas = (questions ?? []).map((q) => ({
    attempt_id: attempt.id,
    question_id: q.id,
    marcada_para_revision: false,
  }));
  if (filas.length > 0) {
    const { error: insErr } = await supabase.from("answers").insert(filas);
    if (insErr) throw new Error(insErr.message);
  }

  redirect(`/attempts/${attempt.id}/run`);
}

/**
 * Guarda la opción elegida de una pregunta. Calcula es_correcta EN SERVIDOR
 * (el cliente nunca conoce la respuesta correcta durante el examen).
 */
export async function saveAnswer(
  attemptId: string,
  questionId: string,
  opcionElegida: number,
): Promise<void> {
  const { data: q, error: qErr } = await supabase
    .from("questions")
    .select("indice_correcta")
    .eq("id", questionId)
    .maybeSingle();
  if (qErr || !q) throw new Error(qErr?.message ?? "Pregunta no encontrada");

  const esCorrecta = opcionElegida === (q as { indice_correcta: number }).indice_correcta;

  const { error } = await supabase
    .from("answers")
    .update({ opcion_elegida: opcionElegida, es_correcta: esCorrecta })
    .eq("attempt_id", attemptId)
    .eq("question_id", questionId);
  if (error) throw new Error(error.message);
}

/**
 * Registra que el usuario reveló la pista de una pregunta. Irreversible por
 * diseño (una vez vista, queda visible y contabilizada): solo pone a true.
 */
export async function revealTip(
  attemptId: string,
  questionId: string,
): Promise<void> {
  const { error } = await supabase
    .from("answers")
    .update({ tip_revelado: true })
    .eq("attempt_id", attemptId)
    .eq("question_id", questionId);
  if (error) throw new Error(error.message);
}

/** Marca/desmarca una pregunta para revisión. */
export async function toggleMark(
  attemptId: string,
  questionId: string,
  marcada: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("answers")
    .update({ marcada_para_revision: marcada })
    .eq("attempt_id", attemptId)
    .eq("question_id", questionId);
  if (error) throw new Error(error.message);
}

/** Finaliza el intento: calcula puntuación y duración, y va a resultados. */
export async function finishAttempt(attemptId: string): Promise<void> {
  const { data: attempt, error: aErr } = await supabase
    .from("attempts")
    .select("started_at, finished_at")
    .eq("id", attemptId)
    .maybeSingle();
  if (aErr || !attempt) throw new Error(aErr?.message ?? "Intento no encontrado");

  if (!(attempt as { finished_at: string | null }).finished_at) {
    const { data: answers, error: ansErr } = await supabase
      .from("answers")
      .select("es_correcta, tip_revelado")
      .eq("attempt_id", attemptId);
    if (ansErr) throw new Error(ansErr.message);

    const filas = (answers ?? []) as Array<{
      es_correcta: boolean | null;
      tip_revelado: boolean;
    }>;
    const aciertos = filas.filter((a) => a.es_correcta === true).length;
    const tipsRevelados = filas.filter((a) => a.tip_revelado).length;

    const startedAt = new Date(
      (attempt as { started_at: string }).started_at,
    ).getTime();
    const duracion = Math.max(0, Math.round((Date.now() - startedAt) / 1000));

    const { error: upErr } = await supabase
      .from("attempts")
      .update({
        finished_at: new Date().toISOString(),
        score: aciertos,
        duracion,
        tips_revelados: tipsRevelados,
      })
      .eq("id", attemptId);
    if (upErr) throw new Error(upErr.message);
  }

  revalidatePath(`/attempts/${attemptId}/result`);
  redirect(`/attempts/${attemptId}/result`);
}

/** Elimina un intento (y sus respuestas por cascada). */
export async function deleteAttempt(
  attemptId: string,
  testId: string,
): Promise<void> {
  const { error } = await supabase.from("attempts").delete().eq("id", attemptId);
  if (error) throw new Error(error.message);
  revalidatePath(`/tests/${testId}`);
}
