// Utilidades de presentación: nombres, avatares y fechas.

const AVATAR_COLORS = ['#1B4332', '#2D6A4F', '#2E74B5', '#7C3AED', '#9F1239', '#0369A1', '#B45309'];

/** Color estable para el avatar de una persona, a partir de su id. */
export function colorFor(seed = '') {
  let hash = 0;
  for (const char of String(seed)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function initialOf(name = '') {
  return (name.trim()[0] || '?').toUpperCase();
}

export function firstName(name = '') {
  return name.trim().split(/\s+/)[0] || '';
}

/** "María Jiménez" → "María J." (como en el foro). */
export function shortName(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || '';
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** El backend guarda un solo nombre; el perfil lo muestra como Nombre y Apellido. */
export function splitName(full = '') {
  const text = full.trim().replace(/\s+/g, ' ');
  const space = text.indexOf(' ');
  if (space < 0) return { firstName: text, lastName: '' };
  return { firstName: text.slice(0, space), lastName: text.slice(space + 1) };
}

export function joinName(first = '', last = '') {
  return `${first} ${last}`.trim().replace(/\s+/g, ' ');
}

const relativeTime = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

/** "hace 2 horas", "ayer", "hace 3 días"; pasada una semana, la fecha. */
export function timeAgo(iso, now = Date.now()) {
  const date = new Date(iso);
  const seconds = Math.round((date.getTime() - now) / 1000); // negativo = pasado
  if (Number.isNaN(seconds) || seconds > -60) return 'hace un momento';
  const abs = Math.abs(seconds);
  if (abs < 3600) return relativeTime.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return relativeTime.format(Math.round(seconds / 3600), 'hour');
  if (abs < 7 * 86400) return relativeTime.format(Math.round(seconds / 86400), 'day');
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function emptyToNull(value) {
  const text = (value ?? '').trim();
  return text === '' ? null : text;
}
