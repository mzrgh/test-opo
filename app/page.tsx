import Link from "next/link";
import { getDashboardStats } from "@/lib/db";
import { DIFFICULTY_DEFS } from "@/lib/difficulty";
import { esGestor } from "@/lib/perfil";
import ConfigNotice, { appConfigured } from "./ConfigNotice";

export const dynamic = "force-dynamic";

function fecha(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Gráfico de línea minimalista en SVG (sin librerías). */
function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) {
    return (
      <p className="muted">
        Necesitas al menos 2 intentos finalizados para ver la evolución.
      </p>
    );
  }
  const W = 600;
  const H = 160;
  const P = 16; // padding interno
  const n = data.length;
  const x = (i: number) => P + (i / (n - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - (v / 100) * (H - 2 * P);
  const points = data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `${P},${H - P} ${points} ${W - P},${H - P}`;

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Evolución de la nota media"
    >
      {[0, 25, 50, 75, 100].map((g) => (
        <line
          key={g}
          x1={P}
          x2={W - P}
          y1={y(g)}
          y2={y(g)}
          className="chart-grid"
        />
      ))}
      <polygon points={area} className="chart-area" />
      <polyline points={points} className="chart-line" />
      {data.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={3} className="chart-dot" />
      ))}
    </svg>
  );
}

export default async function Dashboard() {
  if (!appConfigured) return <ConfigNotice />;

  const stats = await getDashboardStats();
  const gestor = esGestor();

  const kpis = [
    { label: "Temarios subidos", value: stats.nTemarios },
    { label: "Tests generados", value: stats.nTests },
    { label: "Tests realizados", value: stats.nTestsRealizados },
    { label: "Intentos totales", value: stats.nIntentos },
    {
      label: "Nota media",
      value:
        stats.notaMedia10 === null
          ? "—"
          : stats.notaMedia10.toFixed(2).replace(".", ","),
    },
  ];

  return (
    <>
      <h1>Dashboard</h1>
      <p className="muted">Resumen de tu actividad de estudio.</p>

      <div className="kpi-grid">
        {kpis.map((k) => (
          <div className="kpi-card" key={k.label}>
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="quick-row">
        {gestor && (
          <Link href="/generar" className="quick-cta">
            + Subir nuevo temario
          </Link>
        )}
        <Link href="/temarios" className="quick-cta secondary-cta">
          Realizar / Consultar tests
        </Link>
      </div>

      <h2>Evolución de la nota media</h2>
      <div className="panel">
        <Sparkline data={stats.evolucion} />
      </div>

      <h2>Últimos tests completados</h2>
      {stats.recientes.length === 0 ? (
        <p className="muted">
          Todavía no has completado ningún test.{" "}
          <Link href="/temarios">Empieza por aquí</Link>.
        </p>
      ) : (
        <ul className="test-list">
          {stats.recientes.map((r) => (
            <li key={r.attemptId}>
              <span>
                <Link href={`/attempts/${r.attemptId}/result`}>
                  {r.subjectNombre}
                </Link>{" "}
                <span className={`badge ${r.dificultad}`}>
                  {DIFFICULTY_DEFS[r.dificultad].label}
                </span>{" "}
                <span className="muted">· {fecha(r.finishedAt)}</span>
              </span>
              <strong>{r.nota10.toFixed(2).replace(".", ",")}</strong>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
