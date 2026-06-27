import "server-only";

/**
 * Perfil de uso de la instancia, controlado por la variable de entorno
 * `ENABLE_TEMARIO_MANAGEMENT` (.env.local):
 *
 * - `TRUE`  → perfil **Gestor**: puede subir temarios, editar etiquetas y ver
 *   el solucionario (spoiler) de un test.
 * - `FALSE` / ausente / valor inválido → perfil **Estudiante**: solo realiza y
 *   consulta tests; las funciones de gestión quedan ocultas y bloqueadas en
 *   servidor (fail-safe: ante la duda, se restringe).
 *
 * Es un módulo de SERVIDOR: las variables de entorno sin prefijo `NEXT_PUBLIC_`
 * no llegan al navegador. Los componentes cliente reciben el valor como prop
 * desde un server component (ver `app/layout.tsx` → `TopNav`).
 */
export function esGestor(): boolean {
  const v = process.env.ENABLE_TEMARIO_MANAGEMENT?.trim().toLowerCase();
  return v === "true" || v === "1";
}
