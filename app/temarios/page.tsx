import Link from "next/link";
import { getSubjectsWithTests, getEtiquetas } from "@/lib/db";
import ConfigNotice, { appConfigured } from "../ConfigNotice";
import EtiquetaFilter from "./EtiquetaFilter";

export const dynamic = "force-dynamic";

export default async function TemariosPage({
  searchParams,
}: {
  searchParams: Promise<{ etiquetas?: string }>;
}) {
  if (!appConfigured) return <ConfigNotice />;

  const sp = await searchParams;
  const seleccionadas = (sp.etiquetas ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const [subjects, etiquetas] = await Promise.all([
    getSubjectsWithTests(seleccionadas),
    getEtiquetas(),
  ]);

  return (
    <>
      <h1>Realizar / Consultar tests</h1>
      <p className="muted">
        Elige un temario para consultarlo, ver y realizar sus tests.
      </p>

      <EtiquetaFilter etiquetas={etiquetas} seleccionadas={seleccionadas} />

      {subjects.length === 0 ? (
        <p className="muted">
          {seleccionadas.length > 0 ? (
            "Ningún temario tiene todas las etiquetas seleccionadas."
          ) : (
            <>
              No hay temarios todavía.{" "}
              <Link href="/generar">Genera tu primer test</Link>.
            </>
          )}
        </p>
      ) : (
        <div className="cards">
          {subjects.map((s) => (
            <Link key={s.id} href={`/temarios/${s.id}`} className="card-row">
              <span className="card-main">
                <span className="card-title">{s.nombre}</span>
                {s.etiquetas.length > 0 && (
                  <span className="card-tags">
                    {s.etiquetas.map((e) => (
                      <span key={e.id} className="badge">
                        {e.nombre}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <span className="card-count">
                {s.tests.length} test{s.tests.length === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
