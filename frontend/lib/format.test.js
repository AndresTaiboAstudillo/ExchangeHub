import {
  colorFor,
  emptyToNull,
  firstName,
  initialOf,
  joinName,
  shortName,
  splitName,
  timeAgo,
} from './format';

describe('nombres', () => {
  it('abrevia como en el foro', () => {
    expect(shortName('María Jiménez')).toBe('María J.');
    expect(shortName('Juan Carlos Pérez')).toBe('Juan P.');
    expect(shortName('Cher')).toBe('Cher');
    expect(shortName('')).toBe('');
  });

  it('separa y une nombre y apellido sin perder información', () => {
    expect(splitName('Ana María Pérez')).toEqual({ firstName: 'Ana', lastName: 'María Pérez' });
    expect(splitName('  Ana   ')).toEqual({ firstName: 'Ana', lastName: '' });
    const { firstName: first, lastName: last } = splitName('Ana María Pérez');
    expect(joinName(first, last)).toBe('Ana María Pérez');
    expect(joinName(' Ana ', '')).toBe('Ana');
  });

  it('obtiene inicial y primer nombre', () => {
    expect(initialOf('  ágata')).toBe('Á');
    expect(initialOf('')).toBe('?');
    expect(firstName('Hana Leung')).toBe('Hana');
  });

  it('convierte textos vacíos en null', () => {
    expect(emptyToNull('  ')).toBeNull();
    expect(emptyToNull(' Chile ')).toBe('Chile');
    expect(emptyToNull(undefined)).toBeNull();
  });
});

describe('colorFor', () => {
  it('es estable para la misma persona y siempre devuelve un color', () => {
    expect(colorFor('abc')).toBe(colorFor('abc'));
    expect(colorFor('abc')).toMatch(/^#[0-9A-F]{6}$/i);
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-10-19T12:00:00Z').getTime();
  const ago = (ms) => new Date(now - ms).toISOString();

  it('describe lo reciente', () => {
    expect(timeAgo(ago(20 * 1000), now)).toBe('hace un momento');
    expect(timeAgo(ago(5 * 60 * 1000), now)).toBe('hace 5 minutos');
    expect(timeAgo(ago(2 * 3600 * 1000), now)).toBe('hace 2 horas');
    expect(timeAgo(ago(24 * 3600 * 1000), now)).toBe('ayer');
    expect(timeAgo(ago(3 * 24 * 3600 * 1000), now)).toBe('hace 3 días');
  });

  it('pasada una semana muestra la fecha', () => {
    expect(timeAgo(ago(30 * 24 * 3600 * 1000), now)).toMatch(/2026/);
  });

  it('tolera fechas futuras o inválidas', () => {
    expect(timeAgo(new Date(now + 60 * 1000).toISOString(), now)).toBe('hace un momento');
    expect(timeAgo('no-es-fecha', now)).toBe('hace un momento');
  });
});
