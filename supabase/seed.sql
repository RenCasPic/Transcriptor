-- Datos de demostración (sección 12 del brief).
-- Se aplica automáticamente con `supabase db reset` o manualmente con:
--   supabase db execute --file supabase/seed.sql
--
-- Crea un usuario demo (demo@transcriptor.app / Demo1234!) con:
--   - 1 workspace personal (creado por el trigger handle_new_user).
--   - 2 proyectos (uno completo en revisión, otro en borrador sin transcripción).
--   - 1 transcripción con segmentos y timestamps.
--   - 1 artículo generado con SEO, alertas y relaciones a segmentos fuente.
--   - 2 versiones del documento (generación inicial + revisión manual).
--
-- Nota: la inserción directa en auth.users/auth.identities imita el formato
-- que usa GoTrue (el servicio de Auth de Supabase). Si tu versión de GoTrue
-- difiere y el login del usuario demo no funciona, simplemente regístrate
-- manualmente desde /register: el resto de la app funciona igual sin seed.

do $$
declare
  v_demo_user_id uuid := '00000000-0000-0000-0000-000000000001';
  v_workspace_id uuid;
  v_project1_id uuid;
  v_project2_id uuid;
  v_source1_id uuid;
  v_transcript1_id uuid;
  v_document1_id uuid;
begin
  -- Usuario demo -------------------------------------------------------
  if not exists (select 1 from auth.users where id = v_demo_user_id) then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_demo_user_id, 'authenticated', 'authenticated',
      'demo@transcriptor.app', crypt('Demo1234!', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Usuario Demo"}'::jsonb,
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_demo_user_id::text, v_demo_user_id,
      jsonb_build_object('sub', v_demo_user_id::text, 'email', 'demo@transcriptor.app'),
      'email', now(), now(), now()
    );
  end if;

  -- El trigger on_auth_user_created ya creó profile + workspace + membership.
  select id into v_workspace_id from public.workspaces where owner_id = v_demo_user_id limit 1;

  -- Proyecto 1: completo, con transcripción y artículo generado ---------
  insert into public.projects (
    workspace_id, created_by, name, provisional_title, content_type, audience,
    tone, language, primary_keyword, objective, call_to_action, status
  ) values (
    v_workspace_id, v_demo_user_id,
    'Demo: Plan de contenidos trimestral', 'Cómo estructurar un plan de contenidos trimestral',
    'guide', 'Responsables de marketing de contenidos en empresas B2B',
    'professional', 'es', 'plan de contenidos trimestral',
    'Explicar un proceso replicable para planear contenido por objetivos de negocio',
    'Agenda una asesoría gratuita de estrategia de contenidos', 'review'
  ) returning id into v_project1_id;

  insert into public.media_sources (project_id, source_type, original_filename)
  values (v_project1_id, 'manual', null)
  returning id into v_source1_id;

  insert into public.transcripts (project_id, source_id, language, full_text, status)
  values (
    v_project1_id, v_source1_id, 'es',
    'Transcripción de demostración: cómo estructurar un plan de contenidos trimestral.',
    'ready'
  ) returning id into v_transcript1_id;

  insert into public.transcript_segments (transcript_id, segment_index, speaker, start_seconds, end_seconds, text)
  values
    (v_transcript1_id, 0, 'Marina Ortiz', 0, 10, 'Hoy quiero hablar de algo con lo que muchos equipos de marketing luchan: cómo estructurar un plan de contenidos trimestral que realmente se cumpla.'),
    (v_transcript1_id, 1, 'Marina Ortiz', 12, 22, 'Lo primero que hacemos en nuestro equipo es partir de tres objetivos de negocio, no de ideas de contenido sueltas.'),
    (v_transcript1_id, 2, 'Marina Ortiz', 24, 34, 'El segundo paso es mapear esos objetivos contra las preguntas que hacen los clientes en ventas y en soporte.'),
    (v_transcript1_id, 3, 'Marina Ortiz', 36, 46, 'En dos mil veintitrés, pasamos de cuatro artículos al mes sin dirección clara, a doce artículos trimestrales alineados a etapas del embudo.'),
    (v_transcript1_id, 4, 'Marina Ortiz', 48, 58, 'El resultado fue un aumento del cuarenta por ciento en tráfico orgánico calificado en seis meses.'),
    (v_transcript1_id, 5, 'Marina Ortiz', 60, 70, 'Un error común es planear el contenido por formato en lugar de planear por etapa del cliente.'),
    (v_transcript1_id, 6, 'Marina Ortiz', 72, 82, 'Dividimos cada trimestre en tres bloques de cuatro semanas: investigación, producción y distribución.'),
    (v_transcript1_id, 7, 'Marina Ortiz', 84, 94, 'Ningún artículo se publica sin al menos una fuente primaria o un dato verificable.'),
    (v_transcript1_id, 8, 'Marina Ortiz', 96, 106, 'Con un equipo de tres personas es posible sostener doce piezas de calidad por trimestre.'),
    (v_transcript1_id, 9, 'Marina Ortiz', 108, 118, 'Antes de escribir el primer artículo del trimestre, define cómo vas a medir si el plan funcionó.');

  -- Documento generado ---------------------------------------------------
  insert into public.content_documents (
    project_id, title, excerpt, content_json, content_html, content_markdown,
    status, word_count, reading_time_minutes, version
  ) values (
    v_project1_id,
    'Cómo estructurar un plan de contenidos trimestral',
    'Un proceso replicable, basado en objetivos de negocio, para planear contenido trimestral que sí se cumple.',
    '{"type":"doc","content":[
      {"type":"paragraph","attrs":{"blockId":"intro"},"content":[{"type":"text","text":"Estructurar un plan de contenidos trimestral no debería depender de la inspiración del momento: debe partir de objetivos de negocio claros."}]},
      {"type":"heading","attrs":{"level":2,"blockId":"section-1-heading"},"content":[{"type":"text","text":"Parte de objetivos de negocio, no de ideas sueltas"}]},
      {"type":"paragraph","attrs":{"blockId":"section-1-body"},"content":[{"type":"text","text":"El primer paso es partir de tres objetivos de negocio y mapearlos contra las preguntas que hacen los clientes en ventas y soporte."}]},
      {"type":"heading","attrs":{"level":2,"blockId":"section-2-heading"},"content":[{"type":"text","text":"Divide el trimestre en tres bloques"}]},
      {"type":"paragraph","attrs":{"blockId":"section-2-body"},"content":[{"type":"text","text":"Investigación, producción y distribución: cada bloque dura cuatro semanas y ningún artículo se publica sin una fuente verificable."}]},
      {"type":"heading","attrs":{"level":2,"blockId":"section-3-heading"},"content":[{"type":"text","text":"Resultados de aplicar este proceso"}]},
      {"type":"paragraph","attrs":{"blockId":"section-3-body"},"content":[{"type":"text","text":"En 2023 este proceso permitió pasar de cuatro artículos mensuales sin dirección clara a doce piezas trimestrales alineadas al embudo, con un aumento del 40% en tráfico orgánico calificado en seis meses."}]},
      {"type":"heading","attrs":{"level":2,"blockId":"conclusion-heading"},"content":[{"type":"text","text":"Conclusión"}]},
      {"type":"paragraph","attrs":{"blockId":"conclusion-body"},"content":[{"type":"text","text":"Antes de escribir el primer artículo del trimestre, define cómo vas a medir si el plan funcionó. Agenda una asesoría gratuita de estrategia de contenidos."}]}
    ]}'::jsonb,
    '<p data-block-id="intro">Estructurar un plan de contenidos trimestral no debería depender de la inspiración del momento: debe partir de objetivos de negocio claros.</p>
<h2 data-block-id="section-1-heading">Parte de objetivos de negocio, no de ideas sueltas</h2>
<p data-block-id="section-1-body">El primer paso es partir de tres objetivos de negocio y mapearlos contra las preguntas que hacen los clientes en ventas y soporte.</p>
<h2 data-block-id="section-2-heading">Divide el trimestre en tres bloques</h2>
<p data-block-id="section-2-body">Investigación, producción y distribución: cada bloque dura cuatro semanas y ningún artículo se publica sin una fuente verificable.</p>
<h2 data-block-id="section-3-heading">Resultados de aplicar este proceso</h2>
<p data-block-id="section-3-body">En 2023 este proceso permitió pasar de cuatro artículos mensuales sin dirección clara a doce piezas trimestrales alineadas al embudo, con un aumento del 40% en tráfico orgánico calificado en seis meses.</p>
<h2 data-block-id="conclusion-heading">Conclusión</h2>
<p data-block-id="conclusion-body">Antes de escribir el primer artículo del trimestre, define cómo vas a medir si el plan funcionó. Agenda una asesoría gratuita de estrategia de contenidos.</p>',
    E'Estructurar un plan de contenidos trimestral no debería depender de la inspiración del momento.\n\n## Parte de objetivos de negocio, no de ideas sueltas\n\nEl primer paso es partir de tres objetivos de negocio.\n\n## Divide el trimestre en tres bloques\n\nInvestigación, producción y distribución.\n\n## Conclusión\n\nDefine cómo vas a medir si el plan funcionó.',
    'in_review', 142, 1, 2
  ) returning id into v_document1_id;

  insert into public.document_versions (document_id, created_by, version_number, title, content_json, content_html, reason, created_at)
  values
    (v_document1_id, v_demo_user_id, 1, 'Cómo estructurar un plan de contenidos trimestral',
     (select content_json from public.content_documents where id = v_document1_id),
     (select content_html from public.content_documents where id = v_document1_id),
     'initial_generation', now() - interval '2 days'),
    (v_document1_id, v_demo_user_id, 2, 'Cómo estructurar un plan de contenidos trimestral',
     (select content_json from public.content_documents where id = v_document1_id),
     (select content_html from public.content_documents where id = v_document1_id),
     'Revisión editorial antes de publicar', now() - interval '1 day');

  insert into public.seo_metadata (document_id, seo_title, slug, meta_description, primary_keyword, secondary_keywords)
  values (
    v_document1_id,
    'Plan de contenidos trimestral: guía paso a paso',
    'plan-de-contenidos-trimestral',
    'Aprende a estructurar un plan de contenidos trimestral basado en objetivos de negocio, no en ideas sueltas.',
    'plan de contenidos trimestral',
    array['estrategia de contenidos', 'marketing b2b', 'calendario editorial']
  );

  insert into public.content_warnings (document_id, block_id, warning_type, message, status)
  values
    (v_document1_id, 'section-3-body', 'number_verification', 'Verifica que el aumento del 40% en tráfico orgánico coincida exactamente con la fuente.', 'open'),
    (v_document1_id, 'section-3-body', 'date_verification', 'Confirma que el año 2023 mencionado sea correcto respecto al episodio original.', 'resolved');

  insert into public.content_source_links (document_id, block_id, transcript_segment_id, relevance_score)
  select v_document1_id, links.block_id, seg.id, links.score
  from (values
    ('intro', 0, 0.9),
    ('section-1-body', 1, 0.95),
    ('section-1-body', 2, 0.8),
    ('section-2-body', 6, 0.9),
    ('section-2-body', 7, 0.85),
    ('section-3-body', 3, 0.9),
    ('section-3-body', 4, 0.9),
    ('conclusion-body', 9, 0.9)
  ) as links(block_id, segment_index, score)
  join public.transcript_segments seg
    on seg.transcript_id = v_transcript1_id and seg.segment_index = links.segment_index;

  -- Proyecto 2: borrador sin transcripción todavía ------------------------
  insert into public.projects (
    workspace_id, created_by, name, provisional_title, content_type, audience,
    tone, language, objective, status
  ) values (
    v_workspace_id, v_demo_user_id,
    'Borrador: Tendencias de IA en 2025', 'Lo que cambia para los equipos de contenido con IA generativa',
    'opinion', 'Líderes de marketing y producto',
    'conversational', 'es',
    'Dar una perspectiva clara sobre qué automatizar y qué no delegar a la IA', 'draft'
  ) returning id into v_project2_id;

end $$;
