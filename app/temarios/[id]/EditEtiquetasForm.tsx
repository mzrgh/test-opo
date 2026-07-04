"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateSubjectEtiquetasAction, type GenerateState } from "../../actions";
import { NIVELES, separarNivel } from "@/lib/etiquetas";

const initialState: GenerateState = {};

export default function EditEtiquetasForm({
  subjectId,
  etiquetasActuales,
}: {
  subjectId: string;
  etiquetasActuales: string[];
}) {
  const [state, formAction, isPending] = useActionState(
    updateSubjectEtiquetasAction,
    initialState,
  );
  const router = useRouter();

  // Precarga: separa el nivel actual (si lo hay) del resto de etiquetas libres.
  const { nivel, libres } = separarNivel(etiquetasActuales);

  // Al guardar, refresca el server component para ver las etiquetas actualizadas.
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={formAction} className="field">
      <input type="hidden" name="subjectId" value={subjectId} />
      {state.error && <div className="error-box">{state.error}</div>}
      {state.ok && <p className="hint">✅ Etiquetas actualizadas.</p>}

      <label htmlFor="nivel">Tipo (obligatorio)</label>
      <select
        id="nivel"
        name="nivel"
        defaultValue={nivel ?? ""}
        disabled={isPending}
        required
      >
        <option value="" disabled>
          Selecciona un tipo…
        </option>
        {NIVELES.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>

      <label htmlFor="etiquetas" style={{ marginTop: 10 }}>
        Etiquetas
      </label>
      <input
        id="etiquetas"
        type="text"
        name="etiquetas"
        defaultValue={libres.join(", ")}
        placeholder="Ej. Constitución, Tema 7"
        disabled={isPending}
        required
      />
      <p className="hint">
        Separadas por comas (al menos una, además del Tipo). Se guardan
        exactamente estas: lo que quites se desvincula.
      </p>
      <button type="submit" disabled={isPending}>
        {isPending ? "Guardando…" : "Guardar etiquetas"}
      </button>
    </form>
  );
}
