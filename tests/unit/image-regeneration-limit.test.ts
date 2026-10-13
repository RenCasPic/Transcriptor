import { beforeEach, describe, expect, it, vi } from 'vitest';

const DOC_ID = '11111111-1111-4111-8111-111111111111';

// --- Dobles de las dependencias externas (Supabase, OpenAI, Storage) ---
const rpc = vi.fn();
let userCounter = 0;

function chain(result: unknown) {
  const node = { select: () => node, eq: () => node, maybeSingle: async () => result };
  return node;
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: `user-${userCounter}` } } }) },
    from: (table: string) =>
      table === 'content_documents'
        ? chain({ data: { id: DOC_ID, title: 'Mi artículo', project_id: 'p1' } })
        : chain({ data: { id: 'p1', workspace_id: 'ws1', language: 'es' } }),
    rpc,
    storage: {},
  }),
}));

const generateImage = vi.fn();
vi.mock('@/lib/ai/images/openai-image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai/images/openai-image')>()),
  generateImage: (...args: unknown[]) => generateImage(...args),
}));
vi.mock('@/lib/images/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/images/storage')>()),
  uploadArticleImage: async () => ({ url: 'https://x.supabase.co/storage/v1/object/public/article-images/ws1/p1/a.webp', path: 'ws1/p1/a.webp' }),
}));
vi.mock('@/lib/actions/versions', () => ({ createVersionAction: async () => ({ success: true }) }));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

import { generateArticleImageAction } from '@/lib/actions/images';
import { ImageGenerationError } from '@/lib/ai/images/openai-image';
import {
  getMaxRegenerationsPerImage,
  isMissingRegenerationSchema,
  remainingRegenerations,
} from '@/lib/images/limits';

const INPUT = { documentId: DOC_ID, prompt: 'Una oficina luminosa con una libreta', imageKey: 'img-1' };

beforeEach(() => {
  userCounter++; // cada test con otro usuario: el rate limit en memoria no interfiere
  rpc.mockReset();
  generateImage.mockReset();
  process.env.AI_API_KEY = 'sk-test';
  delete process.env.AI_PROVIDER;
  delete process.env.AI_IMAGE_MAX_REGENERATIONS;
});

describe('límite de regeneraciones por imagen', () => {
  it('reserva una generación, genera la imagen y devuelve cuántas quedan', async () => {
    rpc.mockResolvedValueOnce({ data: 1, error: null });
    generateImage.mockResolvedValueOnce({ bytes: new Uint8Array([1]), mimeType: 'image/webp', extension: 'webp' });

    const result = await generateArticleImageAction(INPUT);

    expect(rpc).toHaveBeenCalledWith('use_image_regeneration', {
      p_document_id: DOC_ID,
      p_image_key: 'img-1',
      p_max: 3,
    });
    expect(result).toMatchObject({ success: true, data: { remaining: 2, max: 3 } });
  });

  it('al llegar al límite no llama a la IA y responde REGEN_LIMIT', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });

    const result = await generateArticleImageAction(INPUT);

    expect(generateImage).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false, error: { code: 'REGEN_LIMIT' } });
    if (!result.success) expect(result.error.message).toMatch(/límite de 3 regeneraciones/);
  });

  it('si la IA falla, devuelve la generación reservada (un intento fallido no cuenta)', async () => {
    rpc.mockResolvedValue({ data: 2, error: null });
    generateImage.mockRejectedValueOnce(new ImageGenerationError('CONTENT_REJECTED'));

    const result = await generateArticleImageAction(INPUT);

    expect(result).toMatchObject({ success: false, error: { code: 'CONTENT_REJECTED' } });
    expect(rpc).toHaveBeenCalledWith('release_image_regeneration', { p_document_id: DOC_ID, p_image_key: 'img-1' });
  });

  it('con la migración 0023 sin aplicar genera igualmente, sin límite', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42883', message: 'function use_image_regeneration does not exist' } });
    generateImage.mockResolvedValueOnce({ bytes: new Uint8Array([1]), mimeType: 'image/webp', extension: 'webp' });

    const result = await generateArticleImageAction(INPUT);

    expect(result.success).toBe(true);
    expect(generateImage).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledTimes(1); // no intenta devolver nada que nunca reservó
  });

  it('respeta AI_IMAGE_MAX_REGENERATIONS', async () => {
    process.env.AI_IMAGE_MAX_REGENERATIONS = '5';
    rpc.mockResolvedValueOnce({ data: 2, error: null });
    generateImage.mockResolvedValueOnce({ bytes: new Uint8Array([1]), mimeType: 'image/webp', extension: 'webp' });

    const result = await generateArticleImageAction(INPUT);

    expect(rpc).toHaveBeenCalledWith('use_image_regeneration', expect.objectContaining({ p_max: 5 }));
    expect(result).toMatchObject({ success: true, data: { remaining: 3, max: 5 } });
  });
});

describe('helpers del límite', () => {
  it('máximo por defecto 3 y configurable (1-50)', () => {
    expect(getMaxRegenerationsPerImage({})).toBe(3);
    expect(getMaxRegenerationsPerImage({ AI_IMAGE_MAX_REGENERATIONS: '7' })).toBe(7);
    expect(getMaxRegenerationsPerImage({ AI_IMAGE_MAX_REGENERATIONS: '0' })).toBe(3);
    expect(getMaxRegenerationsPerImage({ AI_IMAGE_MAX_REGENERATIONS: 'abc' })).toBe(3);
    expect(getMaxRegenerationsPerImage({ AI_IMAGE_MAX_REGENERATIONS: '999' })).toBe(3);
  });

  it('restantes nunca baja de 0', () => {
    expect(remainingRegenerations(0, 3)).toBe(3);
    expect(remainingRegenerations(3, 3)).toBe(0);
    expect(remainingRegenerations(9, 3)).toBe(0);
  });

  it('reconoce los errores de "migración sin aplicar"', () => {
    expect(isMissingRegenerationSchema({ code: '42P01' })).toBe(true);
    expect(isMissingRegenerationSchema({ code: 'PGRST202' })).toBe(true);
    expect(isMissingRegenerationSchema({ message: 'relation "document_image_regenerations" does not exist' })).toBe(true);
    expect(isMissingRegenerationSchema({ code: '23505', message: 'duplicate key' })).toBe(false);
    expect(isMissingRegenerationSchema(null)).toBe(false);
  });
});
