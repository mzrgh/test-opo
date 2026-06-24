"use client";

import { useMemo, useState, useTransition } from "react";
import type { AnswerRow, RunQuestion } from "@/lib/db";
import { finishAttempt, saveAnswer, toggleMark } from "@/app/attempt-actions";

const LETRAS = ["A", "B", "C", "D"];

interface LocalAnswer {
  opcion: number | null;
  marcada: boolean;
}

export default function RunClient({
  attemptId,
  subjectNombre,
  questions,
  initialAnswers,
}: {
  attemptId: string;
  subjectNombre: string;
  questions: RunQuestion[];
  initialAnswers: AnswerRow[];
}) {
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>(() => {
    const map: Record<string, LocalAnswer> = {};
    for (const q of questions) map[q.id] = { opcion: null, marcada: false };
    for (const a of initialAnswers) {
      map[a.question_id] = {
        opcion: a.opcion_elegida,
        marcada: a.marcada_para_revision,
      };
    }
    return map;
  });
  const [current, setCurrent] = useState(0);
  const [isFinishing, startFinish] = useTransition();

  const total = questions.length;
  const q = questions[current];
  const estado = answers[q.id] ?? { opcion: null, marcada: false };

  const respondidas = useMemo(
    () => Object.values(answers).filter((a) => a.opcion !== null).length,
    [answers],
  );
  const sinResponder = total - respondidas;

  function elegir(opcion: number) {
    setAnswers((prev) => ({ ...prev, [q.id]: { ...prev[q.id], opcion } }));
    saveAnswer(attemptId, q.id, opcion).catch((e) =>
      console.error("Error guardando respuesta:", e),
    );
  }

  function alternarMarca() {
    const nueva = !estado.marcada;
    setAnswers((prev) => ({
      ...prev,
      [q.id]: { ...prev[q.id], marcada: nueva },
    }));
    toggleMark(attemptId, q.id, nueva).catch((e) =>
      console.error("Error marcando pregunta:", e),
    );
  }

  function finalizar() {
    const msg =
      sinResponder > 0
        ? `Tienes ${sinResponder} pregunta(s) sin responder. ¿Finalizar de todas formas?`
        : "¿Finalizar y corregir el test?";
    if (!confirm(msg)) return;
    startFinish(() => {
      finishAttempt(attemptId).catch((e) =>
        console.error("Error finalizando:", e),
      );
    });
  }

  function claseNav(qid: string, idx: number): string {
    const a = answers[qid];
    const clases = ["nav-cell"];
    if (idx === current) clases.push("current");
    if (a?.marcada) clases.push("marked");
    else if (a?.opcion !== null && a?.opcion !== undefined) clases.push("answered");
    return clases.join(" ");
  }

  return (
    <div className="run-layout">
      <aside className="run-nav">
        <div className="run-nav-head">
          <strong>{respondidas}</strong>/{total} respondidas
        </div>
        <div className="nav-grid">
          {questions.map((qq, idx) => (
            <button
              key={qq.id}
              type="button"
              className={claseNav(qq.id, idx)}
              onClick={() => setCurrent(idx)}
              title={`Pregunta ${idx + 1}`}
            >
              {idx + 1}
            </button>
          ))}
        </div>
        <div className="nav-legend">
          <span><i className="dot answered" /> Respondida</span>
          <span><i className="dot marked" /> Marcada</span>
          <span><i className="dot" /> Sin responder</span>
        </div>
        <button
          type="button"
          className="finish-btn"
          onClick={finalizar}
          disabled={isFinishing}
        >
          {isFinishing ? "Corrigiendo…" : "Finalizar test"}
        </button>
      </aside>

      <section className="run-main">
        <p className="muted run-crumb">{subjectNombre}</p>
        <div className="run-qhead">
          <span>
            Pregunta {current + 1} de {total}
          </span>
          <button
            type="button"
            className={`mark-toggle ${estado.marcada ? "on" : ""}`}
            onClick={alternarMarca}
          >
            {estado.marcada ? "✓ Marcada para revisión" : "Marcar para revisión"}
          </button>
        </div>

        <h2 className="run-enunciado">{q.enunciado}</h2>

        <div className="run-options">
          {q.opciones.map((op, i) => (
            <button
              key={i}
              type="button"
              className={`run-option ${estado.opcion === i ? "selected" : ""}`}
              onClick={() => elegir(i)}
            >
              <span className="opt-letter">{LETRAS[i] ?? i + 1}</span>
              {op}
            </button>
          ))}
        </div>

        <div className="run-controls">
          <button
            type="button"
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
            className="secondary"
          >
            ← Anterior
          </button>
          <button
            type="button"
            onClick={() => setCurrent((c) => Math.min(total - 1, c + 1))}
            disabled={current === total - 1}
            className="secondary"
          >
            Siguiente →
          </button>
        </div>
      </section>
    </div>
  );
}
