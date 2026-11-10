import { describe, expect, it } from 'vitest';
import { CONTENT_TYPES } from '@/lib/validations/project';
import {
  CONTENT_TYPE_BLUEPRINTS,
  contentTypeBlueprint,
  contentTypeInstructions,
  faqInstruction,
} from '@/lib/prompts/content-types';
import { buildArticleMetaPrompt, buildArticlePrompt, buildOutlinePrompt, buildSectionPrompt } from '@/lib/prompts/article';
import type { GenerateArticleInput } from '@/lib/ai/provider';

function input(contentType: string): GenerateArticleInput {
  return {
    project: {
      contentType,
      audience: null,
      tone: 'professional',
      language: 'es',
      objective: null,
      callToAction: null,
      primaryKeyword: null,
      provisionalTitle: null,
      targetReadingMinutes: null,
    },
    transcript: { segments: [{ index: 0, speaker: null, startSeconds: 0, endSeconds: 1, text: 'hola' }] },
  } as unknown as GenerateArticleInput;
}

const notes = [{ point: 'Una idea', sourceSegmentIds: [] }];
const outline = { title: 'T', sections: [{ heading: 'A', noteRefs: [1] }] };

describe('plantillas por tipo de artículo', () => {
  it('hay una plantilla para cada tipo de contenido', () => {
    for (const type of CONTENT_TYPES) expect(CONTENT_TYPE_BLUEPRINTS[type]).toBeDefined();
  });

  it('un tipo desconocido usa la plantilla de guía', () => {
    expect(contentTypeBlueprint('raro')).toBe(CONTENT_TYPE_BLUEPRINTS.guide);
  });

  it('cada tipo aporta una organización distinta', () => {
    const structures = new Set(CONTENT_TYPES.map((t) => contentTypeBlueprint(t).structure));
    expect(structures.size).toBe(CONTENT_TYPES.length);
  });

  it('opinión y preguntas-y-respuestas no llevan FAQ aparte; el resto sí', () => {
    expect(faqInstruction('opinion')).toContain('faq: []');
    expect(faqInstruction('qa')).toContain('faq: []');
    expect(faqInstruction('tutorial')).toContain('3-5 preguntas');
    expect(faqInstruction('summary', 'notas')).toContain('2-3 preguntas');
    expect(faqInstruction('summary', 'notas')).toContain('notas');
  });
});

describe('los prompts usan la plantilla del tipo', () => {
  it('el prompt de una sola llamada incluye organización, formato y FAQ del tipo', () => {
    const prompt = buildArticlePrompt(input('tutorial'));
    expect(prompt).toContain(contentTypeBlueprint('tutorial').structure);
    expect(prompt).toContain(contentTypeBlueprint('tutorial').format);
    expect(prompt).toContain('3-5 preguntas');
    expect(prompt).not.toContain('3-6 preguntas');
  });

  it('un artículo de opinión pide faq vacío', () => {
    expect(buildArticlePrompt(input('opinion'))).toContain('faq: []');
    expect(buildArticleMetaPrompt(input('opinion'), outline, notes)).toContain('faq: []');
  });

  it('el esqueleto recibe la organización, la sección el formato y los metadatos el FAQ del tipo', () => {
    const bp = contentTypeBlueprint('case_study');
    expect(buildOutlinePrompt(input('case_study'), notes)).toContain(bp.outline);
    expect(buildSectionPrompt(input('case_study'), 'Resultados', notes, { index: 1, total: 3 })).toContain(bp.section);
    expect(buildArticleMetaPrompt(input('case_study'), outline, notes)).toContain('2-4 preguntas');
  });

  it('las instrucciones del tipo se identifican por nombre', () => {
    expect(contentTypeInstructions('qa')).toContain('Tipo de contenido: qa.');
  });
});
