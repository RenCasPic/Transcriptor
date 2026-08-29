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

  describe('targetReadingMinutes', () => {
    const base = { name: 'Episodio 12', contentType: 'guide', tone: 'professional', language: 'es' } as const;

    it('es opcional (undefined) para no romper flujos existentes', () => {
      const result = CreateProjectSchema.safeParse(base);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.targetReadingMinutes).toBeUndefined();
    });

    it('normaliza "auto" / "" a null', () => {
      for (const raw of ['auto', '']) {
        const result = CreateProjectSchema.safeParse({ ...base, targetReadingMinutes: raw });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.targetReadingMinutes).toBeNull();
      }
    });

    it('acepta un número de minutos (incluido como string del <select>)', () => {
      expect(CreateProjectSchema.safeParse({ ...base, targetReadingMinutes: 8 }).success).toBe(true);
      const asString = CreateProjectSchema.safeParse({ ...base, targetReadingMinutes: '8' });
      expect(asString.success).toBe(true);
      if (asString.success) expect(asString.data.targetReadingMinutes).toBe(8);
    });

    it('rechaza minutos fuera de rango', () => {
      expect(CreateProjectSchema.safeParse({ ...base, targetReadingMinutes: 0 }).success).toBe(false);
      expect(CreateProjectSchema.safeParse({ ...base, targetReadingMinutes: 120 }).success).toBe(false);
    });
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
