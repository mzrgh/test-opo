"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { AnswerRow, RunQuestion } from "@/lib/db";
import {
  finishAttempt,
  revealTip,
  saveAnswer,
  toggleMark,
} from "@/app/attempt-actions";

const LETRAS = ["A", "B", "C", "D"];
/** Resolución del tick del timer de lectura (ms). 100ms → barra fluida. */
const TICK_MS = 100;

interface LocalAnswer {
  opcion: number | null;
  marcada: boolean;
  tipRevelado: boolean;
}

export default function RunClient({
  attemptId,
  subjectNombre,
  questions,
  initialAnswers,
  conTips,
  segundosBloqueo,
}: {
  attemptId: string;
  subjectNombre: string;
  questions: RunQuestion[];
  initialAnswers: AnswerRow[];
  conTips: boolean;
  segundosBloqueo: number;
}) {
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>(() => {
    const map: Record<string, LocalAnswer> = {};
    for (const q of questions) {
      map[q.id] = { opcion: null, marcada: false, tipRevelado: false };
    }
    for (const a of initialAnswers) {
      map[a.question_id] = {
        opcion: a.opcion_elegida,
        marcada: a.marcada_para_revision,
        tipRevelado: a.tip_revelado,
      };
    }
    return map;
  });
  const [current, setCurrent] = useState(0);
  const [isFinishing, startFinish] = useTransition();

  const total = questions.length;
  const q = questions[current];
  const estado = answers[q.id] ?? {
    opcion: null,
    marcada: false,
    tipRevelado: false,
  };

  // ── Timer de lectura obligatoria ──────────────────────────────────────────
  // Cada vez que se muestra una pregunta (cambio o recarga), las opciones y
  // "Marcar para revisión" quedan bloqueadas `segundosBloqueo` segundos para
  // forzar la lectura del enunciado. La navegación NO se bloquea.
  const [restante, setRestante] = useState(segundosBloqueo);
  useEffect(() => {
    if (segundosBloqueo <= 0) return;
    setRestante(segundosBloqueo);
    const t0 = Date.now();
    const id = setInterval(() => {
      const r = segundosBloqueo - (Date.now() - t0) / 1000;
      if (r <= 0) {
        setRestante(0);
        clearInterval(id);
      } else {
        setRestante(r);
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [q.id, segundosBloqueo]);

  const bloqueado = segundosBloqueo > 0 && restante > 0;
  const pctLectura =
    segundosBloqueo > 0
      ? Math.min(100, ((segundosBloqueo - restante) / segundosBloqueo) * 100)
      : 100;

  const respondidas = useMemo(
    () => Object.values(answers).filter((a) => a.opcion !== null).length,
    [answers],
  );
  const sinResponder = total - respondidas;

  const tipsUsados = useMemo(
    () => Object.values(answers).filter((a) => a.tipRevelado).length,
    [answers],
  );

  function elegir(opcion: number) {
    if (bloqueado) return;
    setAnswers((prev) => ({ ...prev, [q.id]: { ...prev[q.id], opcion } }));
    saveAnswer(attemptId, q.id, opcion).catch((e) =>
      console.error("Error guardando respuesta:", e),
    );
  }

  function alternarMarca() {
    if (bloqueado) return;
    const nueva = !estado.marcada;
    setAnswers((prev) => ({
      ...prev,
      [q.id]: { ...prev[q.id], marcada: nueva },
    }));
    toggleMark(attemptId, q.id, nueva).catch((e) =>
      console.error("Error marcando pregunta:", e),
    );
  }

  // Revelar es irreversible: una vez visto, el tip queda visible y contabilizado.
  function verTip() {
    if (bloqueado || estado.tipRevelado) return;
    setAnswers((prev) => ({
      ...prev,
      [q.id]: { ...prev[q.id], tipRevelado: true },
    }));
    revealTip(attemptId, q.id).catch((e) =>
      console.error("Error revelando pista:", e),
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
        {conTips && (
          <div className="nav-tips-count">💡 {tipsUsados} pista(s) usadas</div>
        )}
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
            disabled={bloqueado}
          >
            {estado.marcada ? "✓ Marcada para revisión" : "Marcar para revisión"}
          </button>
        </div>

        <h2 className="run-enunciado">{q.enunciado}</h2>

        {bloqueado && (
          <div
            className="read-timer"
            role="timer"
            aria-label="Tiempo de lectura obligatoria"
          >
            <div className="progress-bar read-timer-bar">
              <div
                className="progress-fill"
                style={{ width: `${pctLectura}%` }}
              />
            </div>
            <span className="read-timer-label">
              Lee el enunciado… {Math.ceil(restante)} s
            </span>
          </div>
        )}

        <div className="run-options">
          {q.opciones.map((op, i) => (
            <button
              key={i}
              type="button"
              className={`run-option ${estado.opcion === i ? "selected" : ""}`}
              onClick={() => elegir(i)}
              disabled={bloqueado}
            >
              <span className="opt-letter">{LETRAS[i] ?? i + 1}</span>
              {op}
            </button>
          ))}
        </div>

        {conTips && q.tip && (
          <div className="tip-block">
            {estado.tipRevelado ? (
              <div className="tip-box">
                <strong>💡 Pista:</strong> {q.tip}
              </div>
            ) : (
              <button
                type="button"
                className="secondary tip-btn"
                onClick={verTip}
                disabled={bloqueado}
                title="Revelar la pista cuenta en el resultado y ya no se oculta"
              >
                💡 Ver pista
              </button>
            )}
          </div>
        )}

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
