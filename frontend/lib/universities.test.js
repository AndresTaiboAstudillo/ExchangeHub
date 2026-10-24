import {
  categoryLabel,
  crestOf,
  formatDate,
  latestFetch,
  mapUrl,
  ownershipLabel,
  safeWebsite,
  statusInfo,
  websiteLabel,
} from './universities';

describe('crestOf', () => {
  it('usa las iniciales de las palabras significativas', () => {
    expect(crestOf('Universidad Adolfo Ibáñez')).toBe('AI');
    expect(crestOf('Instituto Profesional Duoc UC')).toBe('DU');
    expect(crestOf('Pontificia Universidad Católica de Chile')).toBe('CC');
  });

  it('con una sola palabra significativa usa sus dos primeras letras', () => {
    expect(crestOf('Universidad de Chile')).toBe('CH');
  });

  it('no falla con nombres vacíos o solo genéricos', () => {
    expect(crestOf('')).toBe('?');
    expect(crestOf('Universidad de la')).toBe('UD');
  });
});

describe('statusInfo', () => {
  it('no muestra nada si funciona con normalidad', () => {
    expect(statusInfo({ isVigente: true, operatingStatus: 'funcionando' })).toBeNull();
  });

  it('avisa si está cerrando, en revocación o no vigente', () => {
    expect(statusInfo({ isVigente: true, operatingStatus: 'en_proceso_de_cierre' }).text).toBe(
      'En proceso de cierre',
    );
    expect(statusInfo({ isVigente: true, operatingStatus: 'en_proceso_de_revocacion' }).color).toBe('rose');
    expect(statusInfo({ isVigente: false, operatingStatus: 'funcionando' }).text).toBe('No vigente');
  });
});

describe('enlaces', () => {
  it('solo acepta sitios http y https', () => {
    expect(safeWebsite('https://www.uai.cl')).toBe('https://www.uai.cl/');
    expect(safeWebsite('javascript:alert(1)')).toBeNull();
    expect(safeWebsite('ftp://x.cl')).toBeNull();
    expect(safeWebsite('no es url')).toBeNull();
  });

  it('muestra el dominio sin www', () => {
    expect(websiteLabel('https://www.uai.cl/es')).toBe('uai.cl');
  });

  it('arma el enlace al mapa solo con coordenadas numéricas', () => {
    expect(mapUrl(-33.486, -70.518)).toContain('mlat=-33.486&mlon=-70.518');
    expect(mapUrl(null, -70)).toBeNull();
    expect(mapUrl('1', '2')).toBeNull();
  });
});

describe('etiquetas y fechas', () => {
  it('traduce categoría y propiedad', () => {
    expect(categoryLabel('centro_formacion_tecnica')).toBe('Centro de formación técnica');
    expect(ownershipLabel('particular_con_aportes')).toBe('Particular con aportes');
    expect(ownershipLabel('otra')).toBeNull();
    expect(categoryLabel(null)).toBeNull();
  });

  it('formatea fechas en español y tolera valores inválidos', () => {
    expect(formatDate('2026-10-24T12:00:00.000Z')).toMatch(/24 oct\.? 2026/);
    expect(formatDate(null)).toBeNull();
    expect(formatDate('basura')).toBeNull();
  });

  it('elige la recuperación más reciente', () => {
    expect(
      latestFetch([{ fetchedAt: '2026-10-01T00:00:00Z' }, { fetchedAt: '2026-10-24T00:00:00Z' }]),
    ).toBe('2026-10-24T00:00:00.000Z');
    expect(latestFetch([])).toBeNull();
  });
});
