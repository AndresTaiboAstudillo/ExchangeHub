// Formulario de zonas (solo administradores): valores de los campos y validación, sin React.
import { parseCoordinate } from './listingForm';

/** Área común de todas las zonas (igual que en el backend). */
export const ZONE_RADIUS_M = 400;

export const EMPTY_ZONE = { name: '', description: '', safeHours: '', latitude: '', longitude: '' };

/** Zona de la API → valores de texto para los campos. */
export function zoneToFormValues(z) {
  return {
    name: z.name ?? '',
    description: z.description ?? '',
    safeHours: z.safeHours ?? '',
    latitude: z.latCenter == null ? '' : String(z.latCenter),
    longitude: z.lngCenter == null ? '' : String(z.lngCenter),
  };
}

/** Devuelve { errors } o { body } listo para enviar. El área no se elige: es la misma para todas. */
export function validateZone(v) {
  const errors = {};
  const name = v.name.trim();
  if (name.length < 3) errors.name = 'Escribe un nombre de al menos 3 letras.';
  else if (name.length > 80) errors.name = 'El nombre admite hasta 80 caracteres.';
  const latitude = parseCoordinate(v.latitude, -90, 90);
  const longitude = parseCoordinate(v.longitude, -180, 180);
  if (latitude === null || longitude === null) {
    errors.location = 'Marca el centro en el mapa o escribe latitud y longitud válidas.';
  }
  if (v.description.trim().length > 500) errors.description = 'La descripción admite hasta 500 caracteres.';
  if (v.safeHours.trim().length > 80) errors.safeHours = 'Admite hasta 80 caracteres.';
  if (Object.keys(errors).length) return { errors };
  return {
    body: {
      name,
      description: v.description.trim() || null,
      safeHours: v.safeHours.trim() || null,
      latitude,
      longitude,
    },
  };
}
