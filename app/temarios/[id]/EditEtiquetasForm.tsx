"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateSubjectEtiquetasAction, type GenerateState } from "../../actions";

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

  // Al guardar, refresca el server component para ver las etiquetas actualizadas.
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={formAction} className="field">
      <input type="hidden" name="subjectId" value={subjectId} />
      {state.error && <div className="error-box">{state.error}</div>}
      {state.ok && <p className="hint">✅ Etiquetas actualizadas.</p>}
      <input
        type="text"
        name="etiquetas"
        defaultValue={etiquetasActuales.join(", ")}
        placeholder="Ej. Constitución, Tema 7"
        disabled={isPending}
      />
      <p className="hint">
        Separadas por comas. Se guardan exactamente estas (lo que quites se
        desvincula).
      </p>
      <button type="submit" disabled={isPending}>
        {isPending ? "Guardando…" : "Guardar etiquetas"}
      </button>
    </form>
  );
}
