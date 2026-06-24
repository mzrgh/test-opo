import "server-only";

import { supabase } from "./supabase";
import type { Dificultad } from "./test-contract";

// ── Tipos de fila (lo que vive en Postgres) ──────────────────────────────────

export interface SubjectRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  pdf_path: string | null;
  created_at: string;
}

export interface TestRow {
  id: string;
  subject_id: string;
  dificultad: Dificultad;
  descripcion: string;
  status: string;
  created_at: string;
}

export interface QuestionRow {
  id: string;
  test_id: string;
  enunciado: string;
  opciones: string[];
  indice_correcta: number;
  explicacion: string;
  ref_temario: string | null;
  orden: number;
}

// ── Lecturas ──────────────────────────────────────────────────────────────────

/** Temarios con sus tests, agrupados (para la home). */
export async function getSubjectsWithTests(): Promise<
  Array<SubjectRow & { tests: TestRow[] }>
> {
  const { data: subjects, error: subErr } = await supabase
    .from("subjects")
    .select("*")
    .order("created_at", { ascending: false });
  if (subErr) throw new Error(subErr.message);

  const { data: tests, error: testErr } = await supabase
    .from("tests")
    .select("*")
    .order("created_at", { ascending: false });
  if (testErr) throw new Error(testErr.message);

  const porSubject = new Map<string, TestRow[]>();
  for (const t of (tests ?? []) as TestRow[]) {
    const lista = porSubject.get(t.subject_id) ?? [];
    lista.push(t);
    porSubject.set(t.subject_id, lista);
  }

  return ((subjects ?? []) as SubjectRow[]).map((s) => ({
    ...s,
    tests: porSubject.get(s.id) ?? [],
  }));
}

/** Un test con su temario y sus preguntas ordenadas. */
export async function getTestDetail(testId: string): Promise<{
  test: TestRow;
  subject: SubjectRow;
  questions: QuestionRow[];
} | null> {
  const { data: test, error: testErr } = await supabase
    .from("tests")
    .select("*")
    .eq("id", testId)
    .maybeSingle();
  if (testErr) throw new Error(testErr.message);
  if (!test) return null;

  const { data: subject, error: subErr } = await supabase
    .from("subjects")
    .select("*")
    .eq("id", (test as TestRow).subject_id)
    .maybeSingle();
  if (subErr) throw new Error(subErr.message);

  const { data: questions, error: qErr } = await supabase
    .from("questions")
    .select("*")
    .eq("test_id", testId)
    .order("orden", { ascending: true });
  if (qErr) throw new Error(qErr.message);

  return {
    test: test as TestRow,
    subject: subject as SubjectRow,
    questions: (questions ?? []) as QuestionRow[],
  };
}
