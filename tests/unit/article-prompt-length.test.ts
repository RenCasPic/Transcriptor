import { describe, expect, it } from 'vitest';
import { buildArticlePrompt, buildOutlinePrompt, buildSectionPrompt } from '@/lib/prompts/article';
import type { GenerateArticleInput } from '@/lib/ai/provider';
import type { ExtractedNote } from '@/lib/validations/article';

function makeInput(targetReadingMinutes: number | null): GenerateArticleInput {
  return {
    transcript: {
      fullText: 'hola mundo',
      language: 'es',
      segments: [{ id: 's', index: 0, speaker: null, startSeconds: 0, endSeconds: 1, text: 'hola mundo' }],
    },
    project: {
      contentType: 'guide',
      audience: null,
      tone: 'professional',
      language: 'es',
      primaryKeyword: null,
      objective: null,
      callToAction: null,
      provisionalTitle: null,
      targetReadingMinutes,
    },
  };
}

const NOTES: ExtractedNote[] = Array.from({ length: 24 }, (_, i) => ({ point: `nota ${i}`, sourceSegmentIds: [] }));

describe('prompts de artículo — tiempo de lectura objetivo', () => {
  it('sin objetivo: usa el criterio "la extensión la decide la riqueza de la conversación"', () => {
    const prompt = buildArticlePrompt(makeInput(null));
    expect(prompt).toMatch(/riqueza de la conversación/i);
    expect(prompt).not.toMatch(/Extensión objetivo/i);
  });

  it('con objetivo: pide ~minutos*200 palabras y prohíbe inventar para rellenar', () => {
    const prompt = buildArticlePrompt(makeInput(8));
    expect(prompt).toContain('~1600 palabras');
    expect(prompt).toMatch(/≈ 8 min de lectura/);
    expect(prompt).toMatch(/NUNCA inventes/i);
  });

  it('el prompt de esqueleto ajusta el nº de secciones al objetivo', () => {
    const short = buildOutlinePrompt(makeInput(3), NOTES);
    const long = buildOutlinePrompt(makeInput(20), NOTES);
    expect(short).toMatch(/Extensión objetivo: ~600 palabras/);
    expect(long).toMatch(/Extensión objetivo: ~4000 palabras/);
    // Más minutos -> más secciones sugeridas.
    const secOf = (p: string) => Number(p.match(/Entre \d+ y (\d+) secciones/)?.[1] ?? 0);
    expect(secOf(long)).toBeGreaterThan(secOf(short));
  });

  it('el prompt de sección reparte el presupuesto de palabras', () => {
    const section = buildSectionPrompt(makeInput(10), 'Una sección', NOTES.slice(0, 3), { index: 1, total: 5 });
    expect(section).toMatch(/~400 palabras en total para esta sección/);
    expect(section).toMatch(/no inventes contenido para rellenar/i);
  });
});
