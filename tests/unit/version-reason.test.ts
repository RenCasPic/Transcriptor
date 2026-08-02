import { describe, expect, it } from 'vitest';
import { formatVersionReason } from '@/lib/content/version-reason';

describe('formatVersionReason', () => {
  it('traduce el motivo de generación inicial', () => {
    expect(formatVersionReason('initial_generation')).toBe('Generación inicial del artículo');
  });

  it('traduce el motivo de restauración indicando el número de versión', () => {
    expect(formatVersionReason('restored_from_version_3')).toBe('Restaurada desde la versión 3');
  });

  it('devuelve motivos personalizados sin modificar', () => {
    expect(formatVersionReason('Revisión editorial antes de publicar')).toBe(
      'Revisión editorial antes de publicar',
    );
  });
});
