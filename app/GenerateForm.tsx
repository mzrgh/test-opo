"use client";

import { useActionState } from "react";
import { generateAction, type GenerateState } from "./actions";
import { DIFFICULTY_LIST } from "@/lib/difficulty";

const initialState: GenerateState = {};

export default function GenerateForm() {
  const [state, formAction, isPending] = useActionState(
    generateAction,
    initialState,
  );

  return (
    <form action={formAction} className="panel">
      {state.error && <div className="error-box">{state.error}</div>}

      <div className="field">
        <label htmlFor="nombre">Nombre del temario</label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          placeholder="Ej. Tema 7 — Procedimiento administrativo común"
          disabled={isPending}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="pdf">Temario (PDF)</label>
        <input
          id="pdf"
          name="pdf"
          type="file"
          accept="application/pdf,.pdf"
          disabled={isPending}
          required
        />
      </div>

      <div className="field">
        <label>Dificultad</label>
        <div className="diff-grid">
          {DIFFICULTY_LIST.map((d, idx) => (
            <label className="diff-option" key={d.value}>
              <div className="diff-title">
                <input
                  type="radio"
                  name="dificultad"
                  value={d.value}
                  defaultChecked={idx === 1}
                  disabled={isPending}
                  required
                />
                {d.label}
              </div>
              <div className="diff-desc">{d.description}</div>
            </label>
          ))}
        </div>
      </div>

      <button type="submit" disabled={isPending}>
        {isPending ? "Generando 40 preguntas… (puede tardar 1-3 min)" : "Generar test"}
      </button>
      {isPending && (
        <p className="hint">
          Claude está leyendo el PDF y redactando el test. No cierres la página.
        </p>
      )}
    </form>
  );
}
