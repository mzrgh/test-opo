import { isSupabaseConfigured } from "@/lib/supabase";
import { generationProvider, isGenerationConfigured } from "@/lib/provider";

/** ¿Están las credenciales (Supabase + proveedor de generación) configuradas? */
export const appConfigured = isSupabaseConfigured && isGenerationConfigured;

/** Pantalla compartida cuando faltan credenciales en .env.local. */
export default function ConfigNotice() {
  const keyVar =
    generationProvider.id === "deepseek"
      ? "DEEPSEEK_API_KEY"
      : generationProvider.id === "zai"
        ? "ZAI_API_KEY"
        : "ANTHROPIC_API_KEY";

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
          {isGenerationConfigured ? "✅" : "❌"} {generationProvider.label} (
          <code>{keyVar}</code>)
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
