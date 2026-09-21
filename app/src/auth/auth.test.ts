import { describe, expect, it } from 'vitest';
import { assertInspectorProfile, type InspectorProfile } from './auth';

const profile: InspectorProfile = {
  id: 'user-1',
  full_name: 'Inspector CIVA',
  role: 'inspector',
  active: true,
  company: { id: 'company-civa', name: 'CIVA', legacy_code: 'civa' },
};

describe('acceso del inspector', () => {
  it('acepta un perfil activo y conserva la empresa asignada', () => {
    expect(assertInspectorProfile(profile)).toEqual(profile);
    expect(profile.company.name).toBe('CIVA');
  });

  it('rechaza perfiles inactivos o de otro rol', () => {
    expect(() => assertInspectorProfile({ ...profile, active: false })).toThrow('inactiva');
    expect(() => assertInspectorProfile({ ...profile, role: 'operator' })).toThrow('inspector');
  });
});
