-- ============================================================================
-- tests-opo · Etiquetas de temarios (relación N:M)
-- Añade etiquetado y filtrado de temarios. NO edita 0001_init.sql.
-- Pegar en: Supabase → SQL Editor → New query → Run.
-- ============================================================================

-- ── Etiquetas ─────────────────────────────────────────────────────────────────
-- Catálogo único de etiquetas. La unicidad es case-insensitive (índice sobre
-- lower(nombre)) para que "Constitución" y "constitución" no se dupliquen.
create table if not exists etiquetas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_etiquetas_nombre_lower on etiquetas (lower(nombre));

-- ── Relación temario ↔ etiqueta (N:M) ────────────────────────────────────────
-- PK compuesta: una etiqueta no se repite en el mismo temario.
create table if not exists subject_etiquetas (
  subject_id  uuid not null references subjects(id)  on delete cascade,
  etiqueta_id uuid not null references etiquetas(id) on delete cascade,
  primary key (subject_id, etiqueta_id)
);
create index if not exists idx_subject_etiquetas_subject  on subject_etiquetas(subject_id);
create index if not exists idx_subject_etiquetas_etiqueta on subject_etiquetas(etiqueta_id);
