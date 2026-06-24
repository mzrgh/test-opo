import Link from "next/link";
import { notFound } from "next/navigation";
import { getSubjectDetailWithStats } from "@/lib/db";
import { DIFFICULTY_DEFS } from "@/lib/difficulty";
import ConfigNotice, { appConfigured } from "../../ConfigNotice";

export const dynamic = "force-dynamic";

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { dateStyle: "medium" });
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

  const { subject, tests } = detail;

  return (
    <>
      <p className="muted">
        <Link href="/temarios">← Temarios</Link>
      </p>

      <h1>{subject.nombre}</h1>
      {subject.descripcion && <p className="muted">{subject.descripcion}</p>}

      <h2>
        Tests ({tests.length})
      </h2>

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
                    <strong>{t.mejorPct}%</strong>
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
