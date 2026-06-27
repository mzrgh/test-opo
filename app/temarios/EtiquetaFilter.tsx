"use client";

import { useRouter, usePathname } from "next/navigation";
import type { EtiquetaRow } from "@/lib/db";

/**
 * Filtro de temarios por etiquetas (chips). Selección múltiple con semántica AND
 * (el filtro real lo aplica el servidor). El estado vive en el query param
 * ?etiquetas=id1,id2 para que sea enlazable y sobreviva al refresco.
 */
export default function EtiquetaFilter({
  etiquetas,
  seleccionadas,
}: {
  etiquetas: EtiquetaRow[];
  seleccionadas: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sel = new Set(seleccionadas);

  if (etiquetas.length === 0) return null;

  function navegar(ids: string[]) {
    router.push(ids.length ? `${pathname}?etiquetas=${ids.join(",")}` : pathname);
  }

  function toggle(id: string) {
    const next = new Set(sel);
    next.has(id) ? next.delete(id) : next.add(id);
    navegar([...next]);
  }

  return (
    <div className="etq-filter">
      <span className="muted">Filtrar por etiquetas (todas):</span>
      <div className="etq-chips">
        {etiquetas.map((e) => {
          const activa = sel.has(e.id);
          return (
            <button
              type="button"
              key={e.id}
              onClick={() => toggle(e.id)}
              className={`etq-chip${activa ? " activa" : ""}`}
              aria-pressed={activa}
            >
              {e.nombre}
            </button>
          );
        })}
        {seleccionadas.length > 0 && (
          <button
            type="button"
            className="etq-chip etq-clear"
            onClick={() => navegar([])}
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
