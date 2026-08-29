-- Tiempo de lectura objetivo del artículo (en minutos). NULL = "Automático":
-- la extensión la decide la riqueza de la transcripción (comportamiento
-- previo). Con un valor, la generación (src/lib/prompts/article.ts) apunta a
-- ~minutos * 200 palabras, desarrollando o condensando el contenido REAL de
-- la transcripción para acercarse a esa cifra, sin inventar información.
alter table public.projects
  add column if not exists target_reading_minutes smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'projects_target_reading_minutes_range'
  ) then
    alter table public.projects
      add constraint projects_target_reading_minutes_range
      check (target_reading_minutes is null or (target_reading_minutes between 1 and 60));
  end if;
end $$;
