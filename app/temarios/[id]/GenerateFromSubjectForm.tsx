"use client";

import { useActionState } from "react";
import { generateFromSubjectAction, type GenerateState } from "@/app/actions";
import GenerationProgress from "@/app/GenerationProgress";
import { DIFFICULTY_LIST } from "@/lib/difficulty";

const initialState: GenerateState = {};

export default function GenerateFromSubjectForm({
  subjectId,
}: {
  subjectId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    generateFromSubjectAction,
    initialState,
  );

  return (
    <form action={formAction} className="gen-form">
      <input type="hidden" name="subjectId" value={subjectId} />

      {state.error && <div className="error-box">{state.error}</div>}

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

      <div className="field">
        <label className="check-row">
          <input type="checkbox" name="tips" value="si" disabled={isPending} />
          Generar con pistas (Tips)
        </label>
        <p className="hint">
          Cada pregunta llevará una pista revelable durante el test.
        </p>
      </div>

      <button type="submit" disabled={isPending}>
        {isPending
          ? "Generando… (puede tardar 1-3 min)"
          : "Generar test con esta dificultad"}
      </button>
      <GenerationProgress active={isPending} />
    </form>
  );
}
