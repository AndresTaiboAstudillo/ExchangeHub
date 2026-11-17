import { describe, expect, it } from 'vitest';
import { EMPTY_ZONE, validateZone, zoneToFormValues } from './zoneForm';

const valid = { ...EMPTY_ZONE, name: 'Cerro Alegre', latitude: '-33,0425', longitude: '-71.629' };

describe('formulario de zonas', () => {
  it('arma el cuerpo con coordenadas numéricas y campos vacíos como null', () => {
    expect(validateZone(valid).body).toEqual({
      name: 'Cerro Alegre',
      description: null,
      safeHours: null,
      latitude: -33.0425,
      longitude: -71.629,
    });
  });

  it('pide nombre y centro', () => {
    const { errors } = validateZone({ ...EMPTY_ZONE, name: 'ab' });
    expect(errors.name).toBeTruthy();
    expect(errors.location).toBeTruthy();
    expect(validateZone({ ...valid, latitude: '95' }).errors.location).toBeTruthy();
  });

  it('respeta los largos máximos', () => {
    expect(validateZone({ ...valid, description: 'x'.repeat(501) }).errors.description).toBeTruthy();
    expect(validateZone({ ...valid, safeHours: 'x'.repeat(81) }).errors.safeHours).toBeTruthy();
  });

  it('convierte una zona de la API en valores de campo', () => {
    expect(zoneToFormValues({ name: 'Z', description: null, safeHours: 'Día', latCenter: -33.1, lngCenter: -71.2 })).toEqual({
      name: 'Z',
      description: '',
      safeHours: 'Día',
      latitude: '-33.1',
      longitude: '-71.2',
    });
  });
});
