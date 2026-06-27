import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getTestDetail,
  getInProgressAttempt,
  getFinishedAttempts,
} from "@/lib/db";
import { DIFFICULTY_DEFS } from "@/lib/difficulty";
import { esGestor } from "@/lib/perfil";
import { startAttempt } from "@/app/attempt-actions";

export const dynamic = "force-dynamic";

function fecha(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function duracionLegible(seg: number | null): string {
  if (seg === null) return "—";
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default async function TestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getTestDetail(id);
  if (!detail) notFound();

  const { test, subject, questions } = detail;
  const [enCurso, finalizados] = await Promise.all([
    getInProgressAttempt(id),
    getFinishedAttempts(id),
  ]);

  const mejor =
    finalizados.length > 0
      ? Math.max(...finalizados.map((a) => a.score ?? 0))
      : null;

  // startAttempt necesita el testId; lo fijamos con bind para usarlo como action.
  const startThisAttempt = startAttempt.bind(null, id);
  const gestor = esGestor();

  return (
    <>
      <p className="muted">
        <Link href="/">← Volver</Link>
      </p>

      <h1>{subject?.nombre ?? "Test"}</h1>
      <p>
        <span className={`badge ${test.dificultad}`}>
          {DIFFICULTY_DEFS[test.dificultad].label}
        </span>{" "}
        <span className="muted">
          · {questions.length} preguntas · generado el {fecha(test.created_at)}
        </span>
      </p>
      <p className="muted">{test.descripcion}</p>

      <div className="panel">
        <div className="cta-row">
          <form action={startThisAttempt}>
            <button type="submit">Realizar test</button>
          </form>
          {enCurso && (
            <Link href={`/attempts/${enCurso.id}/run`} className="btn-link">
              ▶ Continuar test en curso
            </Link>
          )}
          {gestor && (
            <Link href={`/tests/${id}/solucionario`} className="btn-link muted">
              Ver solucionario (spoiler)
            </Link>
          )}
        </div>
        {mejor !== null && (
          <p className="hint">
            Mejor resultado hasta ahora: {mejor}/{questions.length}
          </p>
        )}
      </div>

      <h2>Historial de intentos</h2>
      {finalizados.length === 0 ? (
        <p className="muted">Todavía no has completado este test.</p>
      ) : (
        <ul className="test-list">
          {finalizados.map((a) => (
            <li key={a.id}>
              <span>
                <Link href={`/attempts/${a.id}/result`}>
                  {fecha(a.finished_at ?? a.started_at)}
                </Link>{" "}
                <span className="muted">· {duracionLegible(a.duracion)}</span>
              </span>
              <span>
                <strong>{a.score}</strong>/{questions.length}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
