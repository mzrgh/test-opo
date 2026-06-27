import Link from "next/link";
import { notFound } from "next/navigation";
import { getSubjectDetailWithStats } from "@/lib/db";
import { DIFFICULTY_DEFS } from "@/lib/difficulty";
import ConfigNotice, { appConfigured } from "../../ConfigNotice";
import GenerateFromSubjectForm from "./GenerateFromSubjectForm";
import EditEtiquetasForm from "./EditEtiquetasForm";

export const dynamic = "force-dynamic";

function fecha(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function TemarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!appConfigured) return <ConfigNotice />;

  const { id } = await params;
  const detail = await getSubjectDetailWithStats(id);
  if (!detail) notFound();

  const { subject, tests, etiquetas } = detail;

  return (
    <>
      <p className="muted">
        <Link href="/temarios">← Temarios</Link>
      </p>

      <h1>{subject.nombre}</h1>
      {subject.descripcion && <p className="muted">{subject.descripcion}</p>}

      {etiquetas.length > 0 && (
        <div className="card-tags" style={{ marginBottom: 12 }}>
          {etiquetas.map((e) => (
            <span key={e.id} className="badge">
              {e.nombre}
            </span>
          ))}
        </div>
      )}

      <div className="panel">
        <div className="cta-row">
          {subject.pdf_path && (
            <a
              href={`/temarios/${id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-link"
            >
              📄 Ver temario (PDF)
            </a>
          )}
        </div>
        <details className="gen-details">
          <summary>+ Generar nuevo test</summary>
          <GenerateFromSubjectForm subjectId={id} />
        </details>
        <details className="gen-details">
          <summary>+ Editar etiquetas</summary>
          <EditEtiquetasForm
            subjectId={id}
            etiquetasActuales={etiquetas.map((e) => e.nombre)}
          />
        </details>
      </div>

      <h2>Tests ({tests.length})</h2>

      {tests.length === 0 ? (
        <p className="muted">
          Este temario no tiene tests.{" "}
          <Link href="/generar">Genera uno</Link>.
        </p>
      ) : (
        tests.map((t) => (
          <div className="panel test-card" key={t.test.id}>
            <div className="test-card-info">
              <div>
                <span className={`badge ${t.test.dificultad}`}>
                  {DIFFICULTY_DEFS[t.test.dificultad].label}
                </span>{" "}
                <span className="muted">
                  {t.numPreguntas} preguntas · generado el{" "}
                  {fecha(t.test.created_at)}
                </span>
              </div>
              <div className="test-card-stats muted">
                {t.nIntentos === 0 ? (
                  <span>Sin intentos</span>
                ) : (
                  <span>
                    {t.nIntentos} intento{t.nIntentos === 1 ? "" : "s"} · mejor{" "}
                    <strong>
                      {t.mejorNota10 === null
                        ? "—"
                        : t.mejorNota10.toFixed(2).replace(".", ",")}
                    </strong>
                  </span>
                )}
              </div>
            </div>
            <Link href={`/tests/${t.test.id}`} className="btn-link">
              Abrir →
            </Link>
          </div>
        ))
      )}
    </>
  );
}
