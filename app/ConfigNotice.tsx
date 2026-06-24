import { isSupabaseConfigured } from "@/lib/supabase";
import { isAnthropicConfigured } from "@/lib/anthropic";

/** ¿Están las credenciales (Supabase + Anthropic) configuradas? */
export const appConfigured = isSupabaseConfigured && isAnthropicConfigured;

/** Pantalla compartida cuando faltan credenciales en .env.local. */
export default function ConfigNotice() {
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
