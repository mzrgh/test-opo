-- ============================================================================
-- tests-opo · 0003: Tips (pistas por pregunta)
-- Pegar en: Supabase → SQL Editor → New query → Run.
--
-- - tests.con_tips: el test se generó con pistas (atributo del test, como la
--   dificultad). Los tests anteriores quedan en false.
-- - questions.tip: la pista generada por el LLM (null en tests sin tips).
-- - answers.tip_revelado: el usuario reveló la pista durante el intento
--   (irreversible: una vez vista no se re-oculta).
-- - attempts.tips_revelados: denormalizado al finalizar (como score/duracion).
-- ============================================================================

alter table tests
  add column if not exists con_tips boolean not null default false;

alter table questions
  add column if not exists tip text;

alter table answers
  add column if not exists tip_revelado boolean not null default false;

alter table attempts
  add column if not exists tips_revelados int;
