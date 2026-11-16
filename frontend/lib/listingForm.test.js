import { EMPTY_LISTING, parseCoordinate, parsePrice, toFormValues, validateListing } from './listingForm';

const valid = { ...EMPTY_LISTING, name: 'Pieza en Playa Ancha', latitude: '-33,0371', longitude: '-71.6402', priceClp: '$250.000' };

describe('listingForm', () => {
  it('interpreta coordenadas con coma o punto y rechaza lo demás', () => {
    expect(parseCoordinate('-33,0437', -90, 90)).toBe(-33.0437);
    expect(parseCoordinate(' -71.6 ', -180, 180)).toBe(-71.6);
    for (const bad of ['', 'abc', '91', '-91', '1e3', '12.', null]) expect(parseCoordinate(bad, -90, 90)).toBeNull();
  });

  it('interpreta el precio con puntos, $ o espacios', () => {
    expect(parsePrice('250.000')).toEqual({ value: 250000 });
    expect(parsePrice('$ 250000')).toEqual({ value: 250000 });
    expect(parsePrice('')).toEqual({ value: null });
    expect(parsePrice('mucho').error).toBeTruthy();
    expect(parsePrice('-5').error).toBeTruthy();
    expect(parsePrice('99999999').error).toBeTruthy();
  });

  it('arma el cuerpo de la API con textos recortados y vacíos como null', () => {
    const { body, errors } = validateListing({ ...valid, name: '  Pieza en Playa Ancha ', address: '  ', description: '' });
    expect(errors).toBeUndefined();
    expect(body).toEqual({
      name: 'Pieza en Playa Ancha',
      address: null,
      latitude: -33.0371,
      longitude: -71.6402,
      description: null,
      priceClp: 250000,
      availability: 'Disponible',
    });
  });

  it('informa cada error por campo', () => {
    const { errors } = validateListing({ ...EMPTY_LISTING, name: 'ab', priceClp: 'x', description: 'x'.repeat(1001) });
    expect(Object.keys(errors).sort()).toEqual(['description', 'location', 'name', 'priceClp']);
  });

  it('convierte un arriendo de la API a valores de formulario', () => {
    expect(toFormValues({ name: 'A', address: null, latitude: -33.1, longitude: -71.2, description: null, priceClp: 1000, availability: null })).toEqual({
      name: 'A',
      address: '',
      latitude: '-33.1',
      longitude: '-71.2',
      description: '',
      priceClp: '1000',
      availability: '',
    });
  });
});
