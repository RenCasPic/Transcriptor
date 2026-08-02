export function formatVersionReason(reason: string): string {
  if (reason === 'initial_generation') return 'Generación inicial del artículo';

  const restoreMatch = reason.match(/^restored_from_version_(\d+)$/);
  if (restoreMatch) return `Restaurada desde la versión ${restoreMatch[1]}`;

  return reason;
}
