// Reglas de etiquetado de temarios (fuente única, cliente y servidor).
// NO importar "server-only" ni lib/db aquí: este módulo lo usan también los
// componentes cliente (GenerateForm, EditEtiquetasForm) para validar/pintar.

/**
 * Niveles obligatorios y mutuamente excluyentes. Todo temario debe llevar
 * exactamente uno ("General" O "Informática"), nunca ambos ni ninguno.
 */
export const NIVELES = ["General", "Informática"] as const;
export type Nivel = (typeof NIVELES)[number];

/** Normaliza nombres: trim, sin vacíos, sin duplicados (case-insensitive). */
export function normalizarNombres(nombres: string[]): string[] {
  const porClave = new Map<string, string>();
  for (const raw of nombres) {
    const limpio = raw.trim();
    if (!limpio) continue;
    const clave = limpio.toLowerCase();
    if (!porClave.has(clave)) porClave.set(clave, limpio);
  }
  return [...porClave.values()];
}

/** Devuelve el nombre canónico del nivel si `nombre` es uno, o null. */
export function nivelCanonico(nombre: string): Nivel | null {
  const clave = nombre.trim().toLowerCase();
  return NIVELES.find((n) => n.toLowerCase() === clave) ?? null;
}

/** ¿`nombre` es un nombre de nivel (case-insensitive)? */
export function esNivel(nombre: string): boolean {
  return nivelCanonico(nombre) !== null;
}

/**
 * Valida el par (nivel, etiquetas libres). Devuelve un mensaje de error legible
 * o null si es válido. Reglas: nivel ∈ NIVELES; ≥1 etiqueta libre; ninguna libre
 * puede ser un nombre de nivel (evita colar el otro nivel o duplicar el elegido).
 */
export function validarEtiquetas(nivel: string, libres: string[]): string | null {
  if (!nivelCanonico(nivel)) {
    return `Elige un Tipo obligatorio: ${NIVELES.join(" o ")}.`;
  }
  const libresLimpias = normalizarNombres(libres);
  if (libresLimpias.length === 0) {
    return "Añade al menos una etiqueta además del Tipo (mínimo 2 en total).";
  }
  const colada = libresLimpias.find((n) => esNivel(n));
  if (colada) {
    return `"${colada}" es un Tipo y no puede usarse como etiqueta libre. El Tipo se elige en su selector.`;
  }
  return null;
}

/**
 * Combina nivel + libres en la lista final de nombres a persistir, con el nivel
 * en forma canónica y sin duplicados. Asume que ya pasó validarEtiquetas.
 */
export function combinarEtiquetas(nivel: string, libres: string[]): string[] {
  const canon = nivelCanonico(nivel);
  return normalizarNombres([...(canon ? [canon] : []), ...libres]);
}

/**
 * Separa una lista de etiquetas de un temario existente en (nivel, libres),
 * para precargar los formularios de edición. Toma el primer nivel que aparezca.
 */
export function separarNivel(etiquetas: string[]): {
  nivel: Nivel | null;
  libres: string[];
} {
  let nivel: Nivel | null = null;
  const libres: string[] = [];
  for (const e of etiquetas) {
    const canon = nivelCanonico(e);
    if (canon && nivel === null) nivel = canon;
    else if (!canon) libres.push(e);
  }
  return { nivel, libres };
}
