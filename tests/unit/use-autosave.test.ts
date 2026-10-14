import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const saveDocumentAction = vi.fn();
vi.mock('@/lib/actions/editor', () => ({ saveDocumentAction: (...args: unknown[]) => saveDocumentAction(...args) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from 'sonner';
import { useAutosave } from '@/lib/editor/use-autosave';

const SNAPSHOT = { title: 'Título', contentJson: { type: 'doc', content: [] } as never, contentHtml: '<p>x</p>' };
const DOC_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.useFakeTimers();
  saveDocumentAction.mockReset();
  vi.mocked(toast.error).mockClear();
});
afterEach(() => vi.useRealTimers());

describe('useAutosave — fallos del servidor', () => {
  it('si la Server Action lanza una excepción, no se queda en "saving": pasa a error y avisa', async () => {
    saveDocumentAction.mockRejectedValue(new Error('require() of ES Module'));
    const { result } = renderHook(() => useAutosave(DOC_ID, 1));

    act(() => result.current.scheduleSave(SNAPSHOT));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(result.current.status).toBe('error');
    expect(toast.error).toHaveBeenCalledOnce();
  });

  it('tras un fallo, el siguiente cambio vuelve a intentar guardar y se recupera', async () => {
    saveDocumentAction.mockRejectedValueOnce(new Error('boom'));
    saveDocumentAction.mockResolvedValueOnce({ success: true, data: { version: 2, wordCount: 1, readingTimeMinutes: 1 } });
    const { result } = renderHook(() => useAutosave(DOC_ID, 1));

    act(() => result.current.scheduleSave(SNAPSHOT));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.status).toBe('error');

    act(() => result.current.scheduleSave({ ...SNAPSHOT, title: 'Otro' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(saveDocumentAction).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('saved');
  });

  it('si el servidor no responde, tras el tope de tiempo pasa a error', async () => {
    saveDocumentAction.mockReturnValue(new Promise(() => undefined)); // nunca resuelve
    const { result } = renderHook(() => useAutosave(DOC_ID, 1));

    act(() => result.current.scheduleSave(SNAPSHOT));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1300);
    });
    expect(result.current.status).toBe('saving');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(46_000);
    });
    expect(result.current.status).toBe('error');
  });

  it('un guardado correcto sigue marcando "saved"', async () => {
    saveDocumentAction.mockResolvedValue({ success: true, data: { version: 2, wordCount: 5, readingTimeMinutes: 1 } });
    const { result } = renderHook(() => useAutosave(DOC_ID, 1));

    act(() => result.current.scheduleSave(SNAPSHOT));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(result.current.status).toBe('saved');
    expect(result.current.wordCount).toBe(5);
  });
});
