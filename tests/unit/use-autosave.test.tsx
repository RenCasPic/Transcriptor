import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutosave } from '@/lib/editor/use-autosave';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const saveDocumentActionMock = vi.fn();
vi.mock('@/lib/actions/editor', () => ({
  saveDocumentAction: (...args: unknown[]) => saveDocumentActionMock(...args),
}));

describe('useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    saveDocumentActionMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('agrupa cambios rápidos en un único guardado (debounce)', async () => {
    saveDocumentActionMock.mockResolvedValue({
      success: true,
      data: { version: 2, wordCount: 10, readingTimeMinutes: 1 },
    });

    const { result } = renderHook(() => useAutosave('doc-1', 1));

    act(() => {
      result.current.scheduleSave({ title: 'A', contentJson: {}, contentHtml: '<p>A</p>' });
      result.current.scheduleSave({ title: 'AB', contentJson: {}, contentHtml: '<p>AB</p>' });
      result.current.scheduleSave({ title: 'ABC', contentJson: {}, contentHtml: '<p>ABC</p>' });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1300);
    });

    expect(saveDocumentActionMock).toHaveBeenCalledTimes(1);
    expect(saveDocumentActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'ABC', expectedVersion: 1 }),
    );
  });

  it('actualiza la versión esperada tras un guardado exitoso', async () => {
    saveDocumentActionMock.mockResolvedValue({
      success: true,
      data: { version: 5, wordCount: 20, readingTimeMinutes: 1 },
    });

    const { result } = renderHook(() => useAutosave('doc-1', 4));

    act(() => {
      result.current.scheduleSave({ title: 'A', contentJson: {}, contentHtml: '<p>A</p>' });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1300);
    });

    expect(result.current.currentVersion()).toBe(5);
  });

  it('marca estado de conflicto si la versión no coincide', async () => {
    saveDocumentActionMock.mockResolvedValue({
      success: false,
      error: { code: 'VERSION_CONFLICT', message: 'conflicto' },
    });

    const { result } = renderHook(() => useAutosave('doc-1', 1));

    act(() => {
      result.current.scheduleSave({ title: 'A', contentJson: {}, contentHtml: '<p>A</p>' });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1300);
    });

    expect(result.current.status).toBe('conflict');
  });
});
