import Link from "next/link";
import { notFound } from "next/navigation";
import { getTestDetail } from "@/lib/db";
import { DIFFICULTY_DEFS } from "@/lib/difficulty";

export const dynamic = "force-dynamic";

const LETRAS = ["A", "B", "C", "D"];

function fecha(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    dateStyle: "long",
    timeStyle: "short",
  });
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
        <span className="muted">· Generado el {fecha(test.created_at)}</span>
      </p>
      <p className="muted">{test.descripcion}</p>
      <p className="muted">{questions.length} preguntas</p>

      {questions.map((q) => (
        <div className="question" key={q.id}>
          <div className="q-head">
            {q.orden + 1}. {q.enunciado}
          </div>
          <ul className="options">
            {q.opciones.map((op, i) => (
              <li key={i} className={i === q.indice_correcta ? "correct" : ""}>
                <span className="opt-letter">{LETRAS[i] ?? i + 1}</span>
                {op}
              </li>
            ))}
          </ul>
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
      ))}
    </>
  );
}
