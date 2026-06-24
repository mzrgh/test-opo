import "server-only";

import { supabase } from "./supabase";
import type { Dificultad, GeneratedTest } from "./test-contract";

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

// ── Escrituras ────────────────────────────────────────────────────────────────

/**
 * Inserta un test y sus preguntas para un temario ya existente.
 * Devuelve el id del test creado. Lanza en caso de error.
 * Compartido por la generación con PDF nuevo y la regeneración desde temario.
 */
export async function insertTestWithQuestions(
  subjectId: string,
  dificultad: Dificultad,
  generated: GeneratedTest,
): Promise<string> {
  const { data: test, error: testErr } = await supabase
    .from("tests")
    .insert({
      subject_id: subjectId,
      dificultad,
      descripcion: generated.descripcion,
      status: "listo",
    })
    .select("id")
    .single();
  if (testErr || !test) {
    throw new Error(`Error guardando el test: ${testErr?.message}`);
  }

  const filas = generated.preguntas.map((q, i) => ({
    test_id: test.id,
    enunciado: q.enunciado,
    opciones: q.opciones,
    indice_correcta: q.indiceCorrecta,
    explicacion: q.explicacion,
    ref_temario: q.refTemario,
    orden: i,
  }));
  const { error: qErr } = await supabase.from("questions").insert(filas);
  if (qErr) {
    throw new Error(`Error guardando las preguntas: ${qErr.message}`);
  }

  return test.id as string;
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

// ── Tipos de intentos/respuestas ──────────────────────────────────────────────

export interface AttemptRow {
  id: string;
  test_id: string;
  started_at: string;
  finished_at: string | null;
  score: number | null; // nº de aciertos
  duracion: number | null; // segundos
}

export interface AnswerRow {
  id: string;
  attempt_id: string;
  question_id: string;
  opcion_elegida: number | null;
  es_correcta: boolean | null;
  marcada_para_revision: boolean;
}

/** Pregunta SIN solución: lo único que puede ver el cliente durante el examen. */
export interface RunQuestion {
  id: string;
  orden: number;
  enunciado: string;
  opciones: string[];
}

// ── Lecturas de ejecución ─────────────────────────────────────────────────────

/** Intento en curso (sin finalizar) más reciente de un test, o null. */
export async function getInProgressAttempt(
  testId: string,
): Promise<AttemptRow | null> {
  const { data, error } = await supabase
    .from("attempts")
    .select("*")
    .eq("test_id", testId)
    .is("finished_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AttemptRow) ?? null;
}

/** Intentos finalizados de un test, del más reciente al más antiguo. */
export async function getFinishedAttempts(
  testId: string,
): Promise<AttemptRow[]> {
  const { data, error } = await supabase
    .from("attempts")
    .select("*")
    .eq("test_id", testId)
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AttemptRow[];
}

export interface RunData {
  attempt: AttemptRow;
  subject: SubjectRow;
  questions: RunQuestion[];
  answers: AnswerRow[];
}

/** Datos para la pantalla de ejecución (preguntas SIN solución). */
export async function getRunData(attemptId: string): Promise<RunData | null> {
  const { data: attempt, error: aErr } = await supabase
    .from("attempts")
    .select("*")
    .eq("id", attemptId)
    .maybeSingle();
  if (aErr) throw new Error(aErr.message);
  if (!attempt) return null;
  const at = attempt as AttemptRow;

  const { data: test, error: tErr } = await supabase
    .from("tests")
    .select("subject_id")
    .eq("id", at.test_id)
    .maybeSingle();
  if (tErr) throw new Error(tErr.message);

  const { data: subject, error: sErr } = await supabase
    .from("subjects")
    .select("*")
    .eq("id", (test as { subject_id: string }).subject_id)
    .maybeSingle();
  if (sErr) throw new Error(sErr.message);

  // OJO: no seleccionamos indice_correcta ni explicacion (modo examen).
  const { data: questions, error: qErr } = await supabase
    .from("questions")
    .select("id, orden, enunciado, opciones")
    .eq("test_id", at.test_id)
    .order("orden", { ascending: true });
  if (qErr) throw new Error(qErr.message);

  const { data: answers, error: ansErr } = await supabase
    .from("answers")
    .select("*")
    .eq("attempt_id", attemptId);
  if (ansErr) throw new Error(ansErr.message);

  return {
    attempt: at,
    subject: subject as SubjectRow,
    questions: (questions ?? []) as RunQuestion[],
    answers: (answers ?? []) as AnswerRow[],
  };
}

export interface ResultData {
  attempt: AttemptRow;
  test: TestRow;
  subject: SubjectRow;
  questions: QuestionRow[];
  answersByQuestion: Record<string, AnswerRow>;
  aciertos: number;
  fallos: number;
  sinResponder: number;
  total: number;
}

/** Datos para la pantalla de resultados (con solución y respuesta del usuario). */
export async function getResultData(
  attemptId: string,
): Promise<ResultData | null> {
  const detailAttempt = await supabase
    .from("attempts")
    .select("*")
    .eq("id", attemptId)
    .maybeSingle();
  if (detailAttempt.error) throw new Error(detailAttempt.error.message);
  if (!detailAttempt.data) return null;
  const attempt = detailAttempt.data as AttemptRow;

  const detail = await getTestDetail(attempt.test_id);
  if (!detail) return null;

  const { data: answers, error: ansErr } = await supabase
    .from("answers")
    .select("*")
    .eq("attempt_id", attemptId);
  if (ansErr) throw new Error(ansErr.message);

  const answersByQuestion: Record<string, AnswerRow> = {};
  for (const a of (answers ?? []) as AnswerRow[]) {
    answersByQuestion[a.question_id] = a;
  }

  let aciertos = 0;
  let fallos = 0;
  let sinResponder = 0;
  for (const q of detail.questions) {
    const a = answersByQuestion[q.id];
    if (!a || a.opcion_elegida === null) sinResponder++;
    else if (a.es_correcta) aciertos++;
    else fallos++;
  }

  return {
    attempt,
    test: detail.test,
    subject: detail.subject,
    questions: detail.questions,
    answersByQuestion,
    aciertos,
    fallos,
    sinResponder,
    total: detail.questions.length,
  };
}

// ── Dashboard / agregados ─────────────────────────────────────────────────────

export interface DashboardStats {
  nTemarios: number;
  nTests: number;
  nTestsRealizados: number; // tests distintos con ≥1 intento finalizado
  nIntentos: number; // intentos finalizados
  notaMedia10: number | null; // media de (aciertos/preguntas)·10, base 10
  evolucion: number[]; // % de cada intento finalizado, orden cronológico (gráfico)
  recientes: Array<{
    attemptId: string;
    subjectNombre: string;
    dificultad: Dificultad;
    nota10: number; // nota base 10 del intento
    finishedAt: string;
  }>;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [{ count: nTemarios }, { count: nTests }] = await Promise.all([
    supabase.from("subjects").select("*", { count: "exact", head: true }),
    supabase.from("tests").select("*", { count: "exact", head: true }),
  ]);

  // tests + nº de preguntas + dificultad + subject_id
  const { data: testsData, error: tErr } = await supabase
    .from("tests")
    .select("id, subject_id, dificultad, questions(count)");
  if (tErr) throw new Error(tErr.message);
  type TestAggRow = {
    id: string;
    subject_id: string;
    dificultad: Dificultad;
    questions: { count: number }[];
  };
  const numPreguntas = new Map<string, number>();
  const testDificultad = new Map<string, Dificultad>();
  const testSubject = new Map<string, string>();
  for (const t of (testsData ?? []) as TestAggRow[]) {
    numPreguntas.set(t.id, t.questions?.[0]?.count ?? 0);
    testDificultad.set(t.id, t.dificultad);
    testSubject.set(t.id, t.subject_id);
  }

  const { data: subjectsData, error: sErr } = await supabase
    .from("subjects")
    .select("id, nombre");
  if (sErr) throw new Error(sErr.message);
  const subjectNombre = new Map<string, string>();
  for (const s of (subjectsData ?? []) as { id: string; nombre: string }[]) {
    subjectNombre.set(s.id, s.nombre);
  }

  const { data: attempts, error: aErr } = await supabase
    .from("attempts")
    .select("id, test_id, score, finished_at")
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: true });
  if (aErr) throw new Error(aErr.message);
  const fin = (attempts ?? []) as Array<{
    id: string;
    test_id: string;
    score: number | null;
    finished_at: string;
  }>;

  const pctDe = (testId: string, score: number | null): number => {
    const n = numPreguntas.get(testId) ?? 0;
    return n > 0 ? Math.round(((score ?? 0) / n) * 100) : 0;
  };
  const nota10De = (testId: string, score: number | null): number => {
    const n = numPreguntas.get(testId) ?? 0;
    return n > 0 ? ((score ?? 0) / n) * 10 : 0;
  };

  const evolucion = fin.map((a) => pctDe(a.test_id, a.score)); // gráfico en %
  const nIntentos = fin.length;
  const nTestsRealizados = new Set(fin.map((a) => a.test_id)).size;
  const notaMedia10 =
    nIntentos > 0
      ? fin.reduce((s, a) => s + nota10De(a.test_id, a.score), 0) / nIntentos
      : null;

  const recientes = [...fin]
    .reverse()
    .slice(0, 8)
    .map((a) => ({
      attemptId: a.id,
      subjectNombre:
        subjectNombre.get(testSubject.get(a.test_id) ?? "") ?? "—",
      dificultad: (testDificultad.get(a.test_id) ?? "media") as Dificultad,
      nota10: nota10De(a.test_id, a.score),
      finishedAt: a.finished_at,
    }));

  return {
    nTemarios: nTemarios ?? 0,
    nTests: nTests ?? 0,
    nTestsRealizados,
    nIntentos,
    notaMedia10,
    evolucion,
    recientes,
  };
}

export interface SubjectTestStat {
  test: TestRow;
  numPreguntas: number;
  nIntentos: number;
  mejorNota10: number | null; // mejor nota en base 10
}

export interface SubjectDetail {
  subject: SubjectRow;
  tests: SubjectTestStat[];
}

/** Un temario con sus tests y estadísticas de intentos por test. */
export async function getSubjectDetailWithStats(
  subjectId: string,
): Promise<SubjectDetail | null> {
  const { data: subject, error: sErr } = await supabase
    .from("subjects")
    .select("*")
    .eq("id", subjectId)
    .maybeSingle();
  if (sErr) throw new Error(sErr.message);
  if (!subject) return null;

  const { data: testsData, error: tErr } = await supabase
    .from("tests")
    .select("*, questions(count)")
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false });
  if (tErr) throw new Error(tErr.message);
  type TestWithCount = TestRow & { questions: { count: number }[] };
  const tests = (testsData ?? []) as TestWithCount[];
  const testIds = tests.map((t) => t.id);

  let finished: Array<{ test_id: string; score: number | null }> = [];
  if (testIds.length > 0) {
    const { data: att, error: aErr } = await supabase
      .from("attempts")
      .select("test_id, score")
      .in("test_id", testIds)
      .not("finished_at", "is", null);
    if (aErr) throw new Error(aErr.message);
    finished = (att ?? []) as Array<{ test_id: string; score: number | null }>;
  }

  const stats: SubjectTestStat[] = tests.map((t) => {
    const numPreguntas = t.questions?.[0]?.count ?? 0;
    const intentos = finished.filter((a) => a.test_id === t.id);
    const mejorNota10 =
      intentos.length > 0
        ? Math.max(
            ...intentos.map((a) =>
              numPreguntas > 0 ? ((a.score ?? 0) / numPreguntas) * 10 : 0,
            ),
          )
        : null;
    const { questions: _q, ...testRow } = t;
    void _q;
    return {
      test: testRow as TestRow,
      numPreguntas,
      nIntentos: intentos.length,
      mejorNota10,
    };
  });

  return { subject: subject as SubjectRow, tests: stats };
}
