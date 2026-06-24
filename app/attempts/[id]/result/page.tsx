import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getResultData } from "@/lib/db";
import { DIFFICULTY_DEFS } from "@/lib/difficulty";

export const dynamic = "force-dynamic";

const LETRAS = ["A", "B", "C", "D"];

function duracionLegible(seg: number | null): string {
  if (seg === null) return "—";
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getResultData(id);
  if (!data) notFound();

  // Si el intento no está finalizado, mándalo a ejecutarlo (reanudar).
  if (!data.attempt.finished_at) redirect(`/attempts/${id}/run`);

  const { test, subject, questions, answersByQuestion, aciertos, fallos, sinResponder, total } =
    data;
  const pct = total > 0 ? Math.round((aciertos / total) * 100) : 0;

  return (
    <>
      <p className="muted">
        <Link href={`/tests/${test.id}`}>← Volver al test</Link>
      </p>

      <h1>Resultado</h1>
      <p className="muted">
        {subject?.nombre}{" "}
        <span className={`badge ${test.dificultad}`}>
          {DIFFICULTY_DEFS[test.dificultad].label}
        </span>
      </p>

      <div className="panel score-panel">
        <div className="score-big">
          {aciertos}/{total}
          <span className="score-pct"> · {pct}%</span>
        </div>
        <div className="score-detail">
          <span className="ok">✔ {aciertos} aciertos</span>
          <span className="bad">✘ {fallos} fallos</span>
          <span className="muted">○ {sinResponder} sin responder</span>
          <span className="muted">⏱ {duracionLegible(data.attempt.duracion)}</span>
        </div>
      </div>

      <h2>Revisión</h2>
      {questions.map((q) => {
        const a = answersByQuestion[q.id];
        const elegida = a?.opcion_elegida ?? null;
        return (
          <div className="question" key={q.id}>
            <div className="q-head">
              {q.orden + 1}. {q.enunciado}
            </div>
            <ul className="options">
              {q.opciones.map((op, i) => {
                const esCorrecta = i === q.indice_correcta;
                const esElegida = i === elegida;
                const cls = [
                  esCorrecta ? "correct" : "",
                  esElegida && !esCorrecta ? "wrong" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <li key={i} className={cls}>
                    <span className="opt-letter">{LETRAS[i] ?? i + 1}</span>
                    {op}
                    {esCorrecta && <span className="tag ok"> correcta</span>}
                    {esElegida && !esCorrecta && (
                      <span className="tag bad"> tu respuesta</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {elegida === null && (
              <p className="hint">No respondiste esta pregunta.</p>
            )}
            <div className="explain">
              <strong>Explicación:</strong> {q.explicacion}
              {q.ref_temario && (
                <>
                  <br />
                  <strong>Referencia:</strong> <em>{q.ref_temario}</em>
                </>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
