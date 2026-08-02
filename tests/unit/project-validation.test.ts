import { describe, expect, it } from 'vitest';
import { CreateProjectSchema, ImportTranscriptSchema } from '@/lib/validations/project';

describe('CreateProjectSchema', () => {
  it('acepta un proyecto válido', () => {
    const result = CreateProjectSchema.safeParse({
      name: 'Episodio 12',
      contentType: 'guide',
      tone: 'professional',
      language: 'es',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza un nombre demasiado corto', () => {
    const result = CreateProjectSchema.safeParse({
      name: 'Ep',
      contentType: 'guide',
      tone: 'professional',
      language: 'es',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza un tipo de contenido inválido', () => {
    const result = CreateProjectSchema.safeParse({
      name: 'Episodio 12',
      contentType: 'podcast',
      tone: 'professional',
      language: 'es',
    });
    expect(result.success).toBe(false);
  });
});

describe('ImportTranscriptSchema', () => {
  it('rechaza transcripciones demasiado cortas', () => {
    const result = ImportTranscriptSchema.safeParse({
      projectId: '11111111-1111-1111-1111-111111111111',
      sourceType: 'manual',
      text: 'Muy corto',
      language: 'es',
    });
    expect(result.success).toBe(false);
  });

  it('acepta una transcripción válida', () => {
    const result = ImportTranscriptSchema.safeParse({
      projectId: '11111111-1111-1111-1111-111111111111',
      sourceType: 'manual',
      text: 'Esta es una transcripción con contenido suficientemente largo para pasar la validación.',
      language: 'es',
    });
    expect(result.success).toBe(true);
  });
});
