import { createClient } from "@supabase/supabase-js";

// Cliente de SERVIDOR únicamente. Usa la service_role key, que salta RLS.
// Al ser una app local single-user sin auth, el "guardián" es que este código
// solo corre en tu backend local. NUNCA importes esto en un componente cliente.

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const TEMARIOS_BUCKET = "temarios";

/** ¿Hay credenciales reales de Supabase configuradas? */
export const isSupabaseConfigured =
  !!url && !!serviceKey && !url.includes("TU-PROYECTO") && serviceKey !== "tu-service-role-key";

export const supabase = createClient(url ?? "http://localhost", serviceKey ?? "placeholder", {
  auth: { persistSession: false, autoRefreshToken: false },
});
