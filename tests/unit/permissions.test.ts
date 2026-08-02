import { describe, expect, it } from 'vitest';
import { canManageWorkspace, canEditProject, canDeleteProject } from '@/lib/permissions';

describe('permisos de workspace', () => {
  it('owner y admin pueden gestionar el workspace', () => {
    expect(canManageWorkspace('owner')).toBe(true);
    expect(canManageWorkspace('admin')).toBe(true);
  });

  it('editor y viewer no pueden gestionar el workspace', () => {
    expect(canManageWorkspace('editor')).toBe(false);
    expect(canManageWorkspace('viewer')).toBe(false);
  });

  it('owner, admin y editor pueden editar proyectos', () => {
    expect(canEditProject('owner')).toBe(true);
    expect(canEditProject('admin')).toBe(true);
    expect(canEditProject('editor')).toBe(true);
  });

  it('viewer no puede editar proyectos', () => {
    expect(canEditProject('viewer')).toBe(false);
  });

  it('solo owner y admin pueden eliminar proyectos', () => {
    expect(canDeleteProject('owner')).toBe(true);
    expect(canDeleteProject('admin')).toBe(true);
    expect(canDeleteProject('editor')).toBe(false);
    expect(canDeleteProject('viewer')).toBe(false);
  });
});
