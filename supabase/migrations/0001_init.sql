-- ============================================================================
-- tests-opo · Esquema inicial
-- App de uso personal (single-user, sin auth). Toda la BD es del único usuario.
-- Pegar en: Supabase → SQL Editor → New query → Run.
-- ============================================================================

-- ── Temarios ────────────────────────────────────────────────────────────────
-- Un PDF subido por el usuario. pdf_path apunta al objeto en Storage.
create table if not exists subjects (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  descripcion text,
  pdf_path    text,
  created_at  timestamptz not null default now()
);

-- ── Tests generados ───────────────────────────────────────────────────────────
-- Un test de 40 preguntas generado a partir de un temario y una dificultad.
create table if not exists tests (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid not null references subjects(id) on delete cascade,
  dificultad  text not null check (dificultad in ('baja', 'media', 'alta')),
  descripcion text not null,                 -- 1-2 frases del temario (las da Claude)
  status      text not null default 'listo', -- 'generando' | 'listo' | 'error'
  created_at  timestamptz not null default now()
);
create index if not exists idx_tests_subject on tests(subject_id);

-- ── Preguntas ────────────────────────────────────────────────────────────────
-- opciones: array JSON de exactamente 4 strings.
-- indice_correcta: 0-3, posición de la opción correcta dentro de opciones.
-- orden: posición de la pregunta en el test (0-39), preserva la secuencia.
create table if not exists questions (
  id              uuid primary key default gen_random_uuid(),
  test_id         uuid not null references tests(id) on delete cascade,
  enunciado       text not null,
  opciones        jsonb not null,
  indice_correcta int not null check (indice_correcta between 0 and 3),
  explicacion     text not null,
  ref_temario     text,
  orden           int not null
);
create index if not exists idx_questions_test on questions(test_id, orden);

-- ── Ejecuciones (intentos de un test) ─────────────────────────────────────────
-- finished_at = null → test en curso (permite reanudar, HU-19).
create table if not exists attempts (
  id          uuid primary key default gen_random_uuid(),
  test_id     uuid not null references tests(id) on delete cascade,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  score       numeric,
  duracion    int           -- segundos
);
create index if not exists idx_attempts_test on attempts(test_id);

-- ── Respuestas (guardado incremental) ─────────────────────────────────────────
-- Se guardan a medida que el usuario responde, no solo al finalizar.
create table if not exists answers (
  id                    uuid primary key default gen_random_uuid(),
  attempt_id            uuid not null references attempts(id) on delete cascade,
  question_id           uuid not null references questions(id) on delete cascade,
  opcion_elegida        int,
  es_correcta           boolean,
  marcada_para_revision boolean not null default false,
  unique (attempt_id, question_id)
);
create index if not exists idx_answers_attempt on answers(attempt_id);

-- ── Storage: bucket privado para los PDFs de temario ──────────────────────────
insert into storage.buckets (id, name, public)
values ('temarios', 'temarios', false)
on conflict (id) do nothing;
