import {
  bboxParam,
  directionsUrl,
  formatPrice,
  formatRating,
  fromListing,
  fromPlace,
  fromUniversity,
  fromZone,
  matchesQuery,
  ratingLabel,
  starsText,
} from './map';
import { buildPopup } from './mapPopup';

describe('formatPrice', () => {
  it('da formato chileno y tolera valores ausentes', () => {
    expect(formatPrice(280000)).toBe('$280.000/mes');
    expect(formatPrice(null)).toBeNull();
  });
});

describe('bboxParam', () => {
  it('arma oeste,sur,este,norte con 5 decimales', () => {
    const bounds = { getWest: () => -71.6612345678, getSouth: () => -33.06, getEast: () => -71.58, getNorth: () => -33.02 };
    expect(bboxParam(bounds)).toBe('-71.66123,-33.06,-71.58,-33.02');
  });
});

describe('matchesQuery', () => {
  const item = { name: 'Panadería Don Juan', address: 'Av. Argentina 432', badge: { text: 'Panadería' } };
  it('ignora tildes y mayúsculas, y busca en nombre, dirección y categoría', () => {
    expect(matchesQuery(item, 'panaderia')).toBe(true);
    expect(matchesQuery(item, 'ARGENTINA')).toBe(true);
    expect(matchesQuery(item, 'farmacia')).toBe(false);
    expect(matchesQuery(item, '  ')).toBe(true);
  });
});

describe('adaptadores', () => {
  it('alojamiento: precio y cupos', () => {
    const l = fromListing({ id: 'a', name: 'Pieza', address: 'X 1', latitude: -33, longitude: -71, priceClp: 195000, availability: '2 cupos' });
    expect(l).toMatchObject({ kind: 'alojamiento', price: '$195.000/mes', lat: -33, lng: -71, badge: { text: '2 cupos', color: 'amber' } });
    expect(fromListing({ id: 'b', name: 'N', latitude: 0, longitude: 0, availability: 'Disponible' }).badge.color).toBe('green');
  });

  it('comercio: categoría con ícono y horario', () => {
    const p = fromPlace({ id: 'p', category: 'farmacia', name: 'Cruz', latitude: -33, longitude: -71, openingHours: 'Mo-Fr 09:00-20:00' });
    expect(p).toMatchObject({ emoji: '💊', badge: { text: 'Farmacia' }, footer: '🕐 Mo-Fr 09:00-20:00' });
    expect(fromPlace({ id: 'q', category: 'rara', name: 'X', latitude: 0, longitude: 0 }).emoji).toBe('📍');
  });

  it('zona: color, radio y horario seguro', () => {
    const z = fromZone({ id: 'z', name: 'Puerto', safetyLevel: 'caution', latCenter: -33, lngCenter: -71, radiusM: 350, safeHours: 'Evitar después de las 21:00' });
    expect(z).toMatchObject({ kind: 'zona', radius: 350, zoneColor: '#D97706', badge: { text: 'Precaución nocturna' } });
  });
});

describe('buildPopup', () => {
  it('muestra los datos del lugar y el enlace para llegar', () => {
    const node = buildPopup({ emoji: '🏠', name: 'Pieza', price: '$1/mes', address: 'X 1', lat: -33.1, lng: -71.2, badge: { text: 'Disponible' } });
    expect(node.textContent).toContain('Pieza');
    expect(node.textContent).toContain('$1/mes');
    const link = node.querySelector('a');
    expect(link.href).toBe(directionsUrl(-33.1, -71.2));
    expect(link.rel).toContain('noopener');
  });

  it('no interpreta HTML de los nombres (OpenStreetMap no es de confianza)', () => {
    const node = buildPopup({ emoji: '🛒', name: '<img src=x onerror=alert(1)>', address: '<script>x</script>', lat: 0, lng: 0 });
    expect(node.querySelector('img')).toBeNull();
    expect(node.querySelector('script')).toBeNull();
    expect(node.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('solo enlaza sitios web http(s)', () => {
    const bad = buildPopup({ emoji: '🛒', name: 'A', lat: 0, lng: 0, website: 'javascript:alert(1)' });
    expect(bad.querySelectorAll('a')).toHaveLength(1);
    const ok = buildPopup({ emoji: '🛒', name: 'A', lat: 0, lng: 0, website: 'https://ej.cl' });
    expect(ok.querySelectorAll('a')).toHaveLength(2);
  });
});

describe('alojamientos de OpenStreetMap', () => {
  it('hoteles, hostales y hospedajes se muestran como alojamientos y se reseñan como lugares', () => {
    const h = fromPlace({ id: 'h', category: 'hostal', name: 'Hostal', latitude: 0, longitude: 0 });
    expect(h).toMatchObject({ kind: 'alojamiento', reviewTarget: 'place', emoji: '🛏️', color: 'forest', badge: { text: 'Hostal' } });
    expect(fromPlace({ id: 'f', category: 'feria', name: 'F', latitude: 0, longitude: 0 })).toMatchObject({ kind: 'comercio', color: 'amber' });
    expect(fromListing({ id: 'l', name: 'L', latitude: 0, longitude: 0 }).reviewTarget).toBe('listing');
  });
});

describe('universidades', () => {
  it('se adaptan al mapa con tipo, régimen y sitio web', () => {
    const u = fromUniversity({ id: 'u', name: 'PUCV', category: 'universidad', ownership: 'particular_con_aportes', latitude: -33, longitude: -71, website: 'https://pucv.cl', address: null });
    expect(u).toMatchObject({ kind: 'universidad', emoji: '🎓', color: 'blue', lat: -33, categoryId: 'universidad', website: 'https://pucv.cl', footer: 'Particular con aportes' });
    expect(u.badge.text).toBe('Universidad');
    expect(fromUniversity({ id: 'x', name: 'X', latitude: 0, longitude: 0 }).badge).toBeNull();
  });
});

describe('reseñas', () => {
  it('formatea promedio y estrellas', () => {
    expect(formatRating(4.5)).toBe('4,5');
    expect(formatRating(null)).toBe('');
    expect(starsText(3.6)).toBe('★★★★☆');
    expect(starsText(0)).toBe('☆☆☆☆☆');
    expect(starsText(9)).toBe('★★★★★');
    expect(ratingLabel({ average: 4.5, count: 12 })).toBe('★ 4,5 (12)');
    expect(ratingLabel({ average: null, count: 0 })).toBeNull();
  });

  it('el comercio trae su calificación (o ninguna)', () => {
    const base = { id: 'p', category: 'feria', name: 'F', latitude: 0, longitude: 0 };
    expect(fromPlace({ ...base, ratingAverage: 4, ratingCount: 3 }).rating).toEqual({ average: 4, count: 3 });
    expect(fromPlace(base).rating).toEqual({ average: null, count: 0 });
  });

  it('el globo ofrece reseñar comercios y alojamientos (no zonas) y no usa HTML del texto', () => {
    const onReviews = vi.fn();
    const item = { kind: 'comercio', id: 'p1', emoji: '🛒', name: '<img src=x onerror=alert(1)>', lat: 0, lng: 0, rating: { average: 4, count: 2 } };
    const node = buildPopup(item, { onReviews });
    expect(node.querySelector('img')).toBeNull();
    expect(node.textContent).toContain('★ 4,0 (2)');
    const button = node.querySelector('button');
    expect(button.textContent).toBe('Ver reseñas');
    button.click();
    expect(onReviews).toHaveBeenCalledWith('p1');
    expect(buildPopup({ ...item, kind: 'alojamiento' }, { onReviews }).querySelector('button')).not.toBeNull();
    expect(buildPopup({ ...item, kind: 'zona' }, { onReviews }).querySelector('button')).toBeNull();
    expect(buildPopup({ ...item, rating: { average: null, count: 0 } }, { onReviews }).querySelector('button').textContent).toBe('Reseñar');
  });
});
