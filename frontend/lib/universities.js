// Presentación de instituciones de educación superior (datos de GET /universities).

export const CATEGORY_FILTERS = [
  { id: 'universidad', label: 'Universidades' },
  { id: 'instituto_profesional', label: 'Institutos profesionales' },
  { id: 'centro_formacion_tecnica', label: 'Centros de formación técnica' },
  { id: 'todas', label: 'Todas' },
];

export const OWNERSHIP_OPTIONS = [
  { id: '', label: 'Cualquier tipo' },
  { id: 'estatal', label: 'Estatal' },
  { id: 'particular_con_aportes', label: 'Particular con aportes' },
  { id: 'privada', label: 'Privada' },
];

const CATEGORY_LABELS = {
  universidad: 'Universidad',
  instituto_profesional: 'Instituto profesional',
  centro_formacion_tecnica: 'Centro de formación técnica',
};

const OWNERSHIP_LABELS = {
  estatal: 'Estatal',
  particular_con_aportes: 'Particular con aportes',
  privada: 'Privada',
};

const SOURCE_NAMES = { mineduc_ies: 'Mineduc', wikidata: 'Wikidata' };

export const categoryLabel = (category) => CATEGORY_LABELS[category] ?? null;
export const ownershipLabel = (ownership) => OWNERSHIP_LABELS[ownership] ?? null;
export const sourceName = (code) => SOURCE_NAMES[code] ?? code;

/** Etiqueta de estado si la institución no está funcionando con normalidad. */
export function statusInfo({ isVigente, operatingStatus }) {
  if (isVigente === false) return { text: 'No vigente', color: 'rose' };
  if (operatingStatus === 'en_proceso_de_cierre') return { text: 'En proceso de cierre', color: 'amber' };
  if (operatingStatus === 'en_proceso_de_revocacion') {
    return { text: 'En proceso de revocación', color: 'rose' };
  }
  return null;
}

const GENERIC_WORDS = new Set([
  'universidad', 'instituto', 'profesional', 'centro', 'formacion', 'tecnica', 'pontificia',
  'de', 'del', 'la', 'las', 'los', 'el', 'y', 'o', 'en',
]);

const plain = (text) =>
  text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();

/** Iniciales para el escudo: "Universidad Adolfo Ibáñez" → "AI". */
export function crestOf(name = '') {
  const words = name.split(/\s+/).filter(Boolean);
  const significant = words.filter((w) => !GENERIC_WORDS.has(plain(w).replace(/[^a-z]/g, '')));
  const pool = significant.length > 0 ? significant : words;
  const initials = pool
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  if (initials.length >= 2) return initials;
  return (pool[0] ?? '?').slice(0, 2).toUpperCase();
}

/** Solo se enlazan sitios http(s): el dato viene de una fuente externa. */
export function safeWebsite(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

export function websiteLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function mapUrl(latitude, longitude) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;
}

const dateFormat = new Intl.DateTimeFormat('es-CL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? dateFormat.format(date) : null;
}

/** Fecha de la recuperación más reciente entre las fuentes de una institución. */
export function latestFetch(sources = []) {
  const times = sources.map((s) => new Date(s.fetchedAt).getTime()).filter(Number.isFinite);
  return times.length > 0 ? new Date(Math.max(...times)).toISOString() : null;
}
