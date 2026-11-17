import {
  bboxParam,
  directionsUrl,
  formatPrice,
  formatRating,
  fromListing,
  fromPlace,
  fromUniversity,
  fromZone,
  ZONE_UNRATED_COLOR,
  zoneColorFor,
  zoneLevel,
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

  it('zona: radio fijo, color y nivel según las estrellas, y horario', () => {
    const z = fromZone({ id: 'z', name: 'Puerto', latCenter: -33, lngCenter: -71, radiusM: 400, safeHours: 'Hasta las 21:00', ratingAverage: 1.2, ratingCount: 3 });
    expect(z).toMatchObject({
      kind: 'zona',
      reviewTarget: 'zone',
      radius: 400,
      zoneColor: zoneColorFor(1.2),
      badge: { text: 'Mal valorada', color: 'rose' },
      footer: '🕐 Hasta las 21:00',
      rating: { average: 1.2, count: 3 },
    });
    expect(fromZone({ id: 'y', name: 'Y', latCenter: 0, lngCenter: 0, radiusM: 400 })).toMatchObject({
      zoneColor: ZONE_UNRATED_COLOR,
      badge: { text: 'Sin reseñas' },
    });
  });

  it('el color de la zona va de rojo a amarillo a verde con las estrellas', () => {
    const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const [r1, g1] = rgb(zoneColorFor(1));
    const [r5, g5] = rgb(zoneColorFor(5));
    expect(r1).toBeGreaterThan(g1 * 3); // 1★: rojo
    expect(g5).toBeGreaterThan(r5 * 3); // 5★: verde
    // verde dominante en 5★, rojo en 1★, y amarillo (rojo y verde altos, azul bajo) en 3★
    const [r3, g3, b3] = [1, 3, 5].map((i) => parseInt(zoneColorFor(3).slice(i, i + 2), 16));
    expect(r3).toBeGreaterThan(120);
    expect(g3).toBeGreaterThan(120);
    expect(b3).toBeLessThan(40);
    expect(new Set([1, 2, 3, 4, 5].map(zoneColorFor)).size).toBe(5);
    expect(zoneColorFor(0)).toBe(zoneColorFor(1)); // se acota al rango 1–5
    expect(zoneColorFor(null)).toBe(ZONE_UNRATED_COLOR);
  });

  it('el nivel de la zona tiene tres tramos', () => {
    expect(zoneLevel(4.6).label).toBe('Bien valorada');
    expect(zoneLevel(3).label).toBe('Valoración regular');
    expect(zoneLevel(2.4).label).toBe('Mal valorada');
    expect(zoneLevel(null).label).toBe('Sin reseñas');
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

describe('cómo llegar', () => {
  const ua = {
    android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36',
    iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    ipadAsMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17 Safari/605.1.15',
    windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
  };
  const google = 'https://www.google.com/maps/dir/?api=1&destination=-33.04,-71.62';
  const apple = 'https://maps.apple.com/?daddr=-33.04,-71.62';

  it('usa Google Maps en Android, Windows y Mac de escritorio', () => {
    expect(directionsUrl(-33.04, -71.62, { userAgent: ua.android, touchPoints: 5 })).toBe(google);
    expect(directionsUrl(-33.04, -71.62, { userAgent: ua.windows, touchPoints: 0 })).toBe(google);
    expect(directionsUrl(-33.04, -71.62, { userAgent: ua.ipadAsMac, touchPoints: 0 })).toBe(google);
  });

  it('usa Apple Maps en iPhone y en iPad (aunque se presente como Mac)', () => {
    expect(directionsUrl(-33.04, -71.62, { userAgent: ua.iphone, touchPoints: 5 })).toBe(apple);
    expect(directionsUrl(-33.04, -71.62, { userAgent: ua.ipadAsMac, touchPoints: 5 })).toBe(apple);
  });

  it('sin navegador (render en servidor) usa Google Maps', () => {
    expect(directionsUrl(-33.04, -71.62, { userAgent: '', touchPoints: 0 })).toBe(google);
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

  it('el globo ofrece reseñar comercios, alojamientos y zonas, y no usa HTML del texto', () => {
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
    expect(buildPopup({ ...item, kind: 'zona' }, { onReviews }).querySelector('button')).not.toBeNull();
    expect(buildPopup({ ...item, kind: 'universidad' }, { onReviews }).querySelector('button')).toBeNull();
    expect(buildPopup({ ...item, rating: { average: null, count: 0 } }, { onReviews }).querySelector('button').textContent).toBe('Reseñar');
  });
});
