import { describe, expect, it } from 'vitest';
import { saveDraft } from './draftStorage';

describe('saveDraft', () => {
  it('confirma el guardado solo cuando el almacenamiento lo acepta', () => {
    const values = new Map<string, string>();
    const storage = { setItem: (key: string, value: string) => values.set(key, value) };

    expect(saveDraft('draft-1', { version: 1 }, storage)).toBe(true);
    expect(values.get('draft-1')).toContain('"version":1');
  });

  it('devuelve falso cuando el almacenamiento falla', () => {
    const storage = { setItem: () => { throw new Error('quota exceeded'); } };

    expect(saveDraft('draft-1', { version: 1 }, storage)).toBe(false);
  });
});
