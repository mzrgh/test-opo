import Link from "next/link";
import { getSubjectsWithTests } from "@/lib/db";
import ConfigNotice, { appConfigured } from "../ConfigNotice";

export const dynamic = "force-dynamic";

export default async function TemariosPage() {
  if (!appConfigured) return <ConfigNotice />;

  const subjects = await getSubjectsWithTests();

  return (
    <>
      <h1>Realizar / Consultar tests</h1>
      <p className="muted">
        Elige un temario para consultarlo, ver y realizar sus tests.
      </p>

      {subjects.length === 0 ? (
        <p className="muted">
          No hay temarios todavía.{" "}
          <Link href="/generar">Genera tu primer test</Link>.
        </p>
      ) : (
        <div className="cards">
          {subjects.map((s) => (
            <Link key={s.id} href={`/temarios/${s.id}`} className="card-row">
              <span className="card-title">{s.nombre}</span>
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
