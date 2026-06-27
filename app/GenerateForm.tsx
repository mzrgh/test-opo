"use client";

import { useActionState, useState } from "react";
import { generateAction, type GenerateState } from "./actions";
import { DIFFICULTY_LIST } from "@/lib/difficulty";
import { APP_CONFIG, MAX_PDF_BYTES } from "@/lib/app-config";

const initialState: GenerateState = {};

export default function GenerateForm() {
  const [state, formAction, isPending] = useActionState(
    generateAction,
    initialState,
  );
  // Aviso instantáneo de tamaño en cliente (la validación real es en servidor).
  const [avisoTamano, setAvisoTamano] = useState<string | null>(null);

  function onPdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && file.size > MAX_PDF_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setAvisoTamano(
        `Ese PDF pesa ${mb} MB y el máximo es ${APP_CONFIG.maxPdfMB} MB. Elige uno más pequeño.`,
      );
    } else {
      setAvisoTamano(null);
    }
  }

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
          onChange={onPdfChange}
          disabled={isPending}
          required
        />
        <p className="hint">
          Máx. {APP_CONFIG.maxPdfMB} MB y {APP_CONFIG.maxPdfPaginas} páginas.
        </p>
        {avisoTamano && <div className="error-box">{avisoTamano}</div>}
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

      <button type="submit" disabled={isPending || avisoTamano !== null}>
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
