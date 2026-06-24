import Link from "next/link";
import GenerateForm from "./GenerateForm";
import { getSubjectsWithTests } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase";
import { isAnthropicConfigured } from "@/lib/anthropic";
import { DIFFICULTY_DEFS } from "@/lib/difficulty";

export const dynamic = "force-dynamic";

function fecha(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function Home() {
  if (!isSupabaseConfigured || !isAnthropicConfigured) {
    return (
      <div className="panel">
        <h1>Configura tus credenciales</h1>
        <p className="muted">
          Antes de usar la app, rellena <code>.env.local</code> y reinicia el
          servidor (<code>npm run dev</code>).
        </p>
        <ul>
          <li>
            {isSupabaseConfigured ? "✅" : "❌"} Supabase (
            <code>SUPABASE_URL</code>, <code>SUPABASE_SERVICE_ROLE_KEY</code>)
          </li>
          <li>
            {isAnthropicConfigured ? "✅" : "❌"} Anthropic (
            <code>ANTHROPIC_API_KEY</code>)
          </li>
        </ul>
        <p className="muted">
          Recuerda ejecutar también la migración{" "}
          <code>supabase/migrations/0001_init.sql</code> en el SQL Editor de
          Supabase.
        </p>
      </div>
    );
  }

  const subjects = await getSubjectsWithTests();

  return (
    <>
      <h1>Tus temarios y tests</h1>
      <p className="muted">
        Sube un temario en PDF, elige la dificultad y genera un test de 40
        preguntas.
      </p>

      <GenerateForm />

      <h2>Temarios</h2>
      {subjects.length === 0 ? (
        <p className="muted">
          Aún no hay temarios. Genera tu primer test con el formulario de arriba.
        </p>
      ) : (
        subjects.map((s) => (
          <div className="panel subject" key={s.id}>
            <strong>{s.nombre}</strong>
            {s.descripcion && (
              <p className="muted" style={{ margin: "4px 0 0" }}>
                {s.descripcion}
              </p>
            )}
            {s.tests.length === 0 ? (
              <p className="hint">Sin tests.</p>
            ) : (
              <ul className="test-list">
                {s.tests.map((t) => (
                  <li key={t.id}>
                    <span>
                      <Link href={`/tests/${t.id}`}>
                        Test del {fecha(t.created_at)}
                      </Link>
                    </span>
                    <span className={`badge ${t.dificultad}`}>
                      {DIFFICULTY_DEFS[t.dificultad].label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))
      )}
    </>
  );
}
