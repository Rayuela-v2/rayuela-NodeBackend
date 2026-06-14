import { getTaskTypeName } from './task-type';

describe('getTaskTypeName', () => {
  it('returns the value itself for the legacy string form', () => {
    expect(getTaskTypeName('Recoger residuos')).toBe('Recoger residuos');
  });

  it('returns the name for the object form', () => {
    expect(
      getTaskTypeName({ name: 'Recoger residuos', description: 'Ver guía' }),
    ).toBe('Recoger residuos');
  });

  it('returns the name when the object has no description', () => {
    expect(getTaskTypeName({ name: 'Recoger residuos' })).toBe(
      'Recoger residuos',
    );
  });
});
