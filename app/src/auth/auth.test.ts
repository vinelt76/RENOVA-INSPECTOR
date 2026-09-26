import { describe, expect, it } from 'vitest';
import { assertInspectorProfile, cacheInspectorProfile, cachedInspectorProfile, type InspectorProfile } from './auth';

const profile: InspectorProfile = {
  id: 'user-1',
  full_name: 'Inspector CIVA',
  role: 'inspector',
  active: true,
  company: { id: 'company-civa', name: 'CIVA', legacy_code: 'civa' },
};

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    clear: () => storage.clear(),
  },
  configurable: true,
});

describe('acceso del inspector', () => {
  it('acepta un perfil activo y conserva la empresa asignada', () => {
    expect(assertInspectorProfile(profile)).toEqual(profile);
    expect(profile.company.name).toBe('CIVA');
  });

  it('rechaza perfiles inactivos o de otro rol', () => {
    expect(() => assertInspectorProfile({ ...profile, active: false })).toThrow('inactiva');
    expect(() => assertInspectorProfile({ ...profile, role: 'operator' })).toThrow('inspector');
  });

  it('recupera solo el perfil local de la sesión que lo guardó', () => {
    localStorage.clear();
    cacheInspectorProfile(profile);

    expect(cachedInspectorProfile('user-1')).toEqual(profile);
    expect(cachedInspectorProfile('user-2')).toBeNull();
  });
});
