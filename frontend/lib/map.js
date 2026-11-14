// Lógica pura del mapa de Inicio (sin React ni Leaflet), para poder probarla aparte.
import { categoryLabel, ownershipLabel } from './universities';

export const VALPARAISO = { center: [-33.04, -71.61], zoom: 13 };

/** Categorías de comercios (coinciden con las del backend). */
export const PLACE_CATEGORIES = {
  feria: { label: 'Feria', emoji: '🛒', badge: 'green' },
  supermercado: { label: 'Supermercado', emoji: '🛍️', badge: 'blue' },
  minimarket: { label: 'Minimarket', emoji: '🏪', badge: 'amber' },
  panaderia: { label: 'Panadería', emoji: '🥖', badge: 'amber' },
  verduleria: { label: 'Verdulería', emoji: '🥬', badge: 'green' },
  farmacia: { label: 'Farmacia', emoji: '💊', badge: 'purple' },
  lavanderia: { label: 'Lavandería', emoji: '🧺', badge: 'blue' },
  // Alojamientos turísticos de OpenStreetMap (pestaña Alojamiento).
  hotel: { label: 'Hotel', emoji: '🏨', badge: 'blue' },
  hostal: { label: 'Hostal', emoji: '🛏️', badge: 'amber' },
  hospedaje: { label: 'Hospedaje', emoji: '🏡', badge: 'green' },
};

export const LODGING_CATEGORY_IDS = ['hotel', 'hostal', 'hospedaje'];
export const COMMERCE_CATEGORY_IDS = Object.keys(PLACE_CATEGORIES).filter((id) => !LODGING_CATEGORY_IDS.includes(id));
export const isLodging = (category) => LODGING_CATEGORY_IDS.includes(category);

export const SAFETY = {
  safe: { label: 'Segura', emoji: '🟢', badge: 'green', color: '#059669', background: '#D1FAE5' },
  caution: { label: 'Precaución nocturna', emoji: '🟡', badge: 'amber', color: '#D97706', background: '#FEF3C7' },
  busy: { label: 'Muy transitada', emoji: '🔵', badge: 'blue', color: '#2563EB', background: '#DBEAFE' },
};

const clp = new Intl.NumberFormat('es-CL');

export function formatPrice(priceClp) {
  return typeof priceClp === 'number' ? `$${clp.format(priceClp)}/mes` : null;
}

/** Zona visible de Leaflet → `oeste,sur,este,norte` con 5 decimales (≈1 m). */
export function bboxParam(bounds) {
  const n = (v) => Number(v.toFixed(5));
  return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].map(n).join(',');
}

/** Promedio con coma decimal: 4.5 → "4,5". */
export function formatRating(average) {
  return typeof average === 'number' ? average.toFixed(1).replace('.', ',') : '';
}

/** "★★★★☆" para una nota de 0 a 5 (se redondea a la estrella más cercana). */
export function starsText(value) {
  const full = Math.max(0, Math.min(5, Math.round(value || 0)));
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

/** "★ 4,5 (12)" o null si todavía no hay reseñas. */
export function ratingLabel(rating) {
  return rating?.count > 0 ? `★ ${formatRating(rating.average)} (${rating.count})` : null;
}

export function directionsUrl(lat, lng) {
  return `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}`;
}

/** Texto sin tildes ni mayúsculas, para buscar "panaderia" y encontrar "Panadería". */
const fold = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function matchesQuery(item, q) {
  const needle = fold(q).trim();
  if (!needle) return true;
  return fold(`${item.name} ${item.address ?? ''} ${item.badge?.text ?? ''}`).includes(needle);
}

/**
 * Los tres tipos de dato (alojamiento, comercio, zona) con una misma forma para la lista y el mapa:
 * { id, kind, name, address, lat, lng, emoji, color, price, badge, footer, description, ... }
 */
export function fromListing(l) {
  return {
    id: l.id,
    kind: 'alojamiento',
    name: l.name,
    address: l.address ?? '',
    lat: l.latitude,
    lng: l.longitude,
    emoji: '🏠',
    color: 'forest',
    price: formatPrice(l.priceClp),
    badge: l.availability ? { text: l.availability, color: /cupo/i.test(l.availability) ? 'amber' : 'green' } : null,
    description: l.description,
    reviewTarget: 'listing',
    rating: { average: l.ratingAverage ?? null, count: l.ratingCount ?? 0 },
  };
}

export function fromPlace(p) {
  const meta = PLACE_CATEGORIES[p.category] ?? { label: p.category, emoji: '📍', badge: 'green' };
  const lodging = isLodging(p.category);
  return {
    id: p.id,
    kind: lodging ? 'alojamiento' : 'comercio',
    reviewTarget: 'place',
    name: p.name,
    address: p.address ?? '',
    lat: p.latitude,
    lng: p.longitude,
    emoji: meta.emoji,
    color: lodging ? 'forest' : 'amber',
    badge: { text: meta.label, color: meta.badge },
    footer: p.openingHours ? `🕐 ${p.openingHours}` : null,
    website: p.website,
    rating: { average: p.ratingAverage ?? null, count: p.ratingCount ?? 0 },
  };
}

export function fromUniversity(u) {
  const label = categoryLabel(u.category);
  return {
    id: u.id,
    kind: 'universidad',
    name: u.name,
    address: u.address ?? '',
    lat: u.latitude,
    lng: u.longitude,
    emoji: '🎓',
    color: 'blue',
    badge: label ? { text: label, color: 'blue' } : null,
    footer: ownershipLabel(u.ownership),
    website: u.website,
    categoryId: u.category,
  };
}

export function fromZone(z) {
  const meta = SAFETY[z.safetyLevel] ?? SAFETY.busy;
  return {
    id: z.id,
    kind: 'zona',
    name: z.name,
    address: z.description ?? '',
    lat: z.latCenter,
    lng: z.lngCenter,
    radius: z.radiusM,
    emoji: meta.emoji,
    color: 'green',
    zoneColor: meta.color,
    background: meta.background,
    badge: { text: meta.label, color: meta.badge },
    footer: z.safeHours ? `🌙 ${z.safeHours}` : null,
  };
}
