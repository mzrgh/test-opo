"use client";

import { useEffect, useState } from "react";

// Fases orientativas mostradas mientras la generación está en curso. El % es una
// estimación (no hay canal de progreso real en la Server Action): avanza
// asintóticamente hacia ~90% para comunicar actividad sin "mentir" con un 100%.
const FASES = [
  { hasta: 15, texto: "Subiendo temario…" },
  { hasta: 35, texto: "Leyendo el PDF…" },
  { hasta: 80, texto: "Redactando 40 preguntas…" },
  { hasta: 100, texto: "Validando y equilibrando respuestas…" },
];

export default function GenerationProgress({ active }: { active: boolean }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      return;
    }
    const id = setInterval(() => {
      // Aproximación asintótica al 90%: rápido al principio, lento al final.
      setProgress((p) => (p < 90 ? p + (90 - p) * 0.08 : p));
    }, 400);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;

  const fase = FASES.find((f) => progress < f.hasta) ?? FASES[FASES.length - 1];

  return (
    <div className="progress" role="status" aria-live="polite">
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${Math.round(progress)}%` }}
        />
      </div>
      <p className="hint progress-label">
        {fase.texto} No cierres la página (puede tardar 1-3 min).
      </p>
    </div>
  );
}
