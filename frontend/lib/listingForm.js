// Formulario de arriendos (solo administradores): valores de los campos y validación, sin React.

export const AVAILABILITY_OPTIONS = ['Disponible', '1 cupo', '2 cupos', '3 cupos', 'Ocupado'];

export const EMPTY_LISTING = {
  name: '',
  address: '',
  latitude: '',
  longitude: '',
  description: '',
  priceClp: '',
  availability: 'Disponible',
};

/** Arriendo de la API → valores de texto para los campos. */
export function toFormValues(l) {
  return {
    name: l.name ?? '',
    address: l.address ?? '',
    latitude: l.latitude == null ? '' : String(l.latitude),
    longitude: l.longitude == null ? '' : String(l.longitude),
    description: l.description ?? '',
    priceClp: l.priceClp == null ? '' : String(l.priceClp),
    availability: l.availability ?? '',
  };
}

/** Acepta "-33,0437" o "-33.0437". Devuelve null si no es un número dentro del rango. */
export function parseCoordinate(text, min, max) {
  const value = String(text ?? '').trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

/** "250.000", "$250000" o "250000" → 250000. */
export function parsePrice(text) {
  const digits = String(text ?? '').replace(/[\s.$]/g, '');
  if (digits === '') return { value: null };
  if (!/^\d+$/.test(digits)) return { error: 'Usa solo números, por ejemplo 250000.' };
  const n = Number(digits);
  return n > 20_000_000 ? { error: 'El precio es demasiado alto.' } : { value: n };
}

/** Valida los campos. Devuelve { errors } o { body } listo para enviar a la API. */
export function validateListing(v) {
  const errors = {};
  const name = v.name.trim();
  if (name.length < 3) errors.name = 'Escribe un nombre de al menos 3 letras.';
  else if (name.length > 120) errors.name = 'El nombre admite hasta 120 caracteres.';

  const latitude = parseCoordinate(v.latitude, -90, 90);
  const longitude = parseCoordinate(v.longitude, -180, 180);
  if (latitude === null || longitude === null) {
    errors.location = 'Marca el punto en el mapa o escribe latitud y longitud válidas.';
  }
  const price = parsePrice(v.priceClp);
  if (price.error) errors.priceClp = price.error;
  if (v.address.trim().length > 200) errors.address = 'La dirección admite hasta 200 caracteres.';
  if (v.description.trim().length > 1000) errors.description = 'La descripción admite hasta 1000 caracteres.';
  if (v.availability.trim().length > 60) errors.availability = 'Admite hasta 60 caracteres.';

  if (Object.keys(errors).length) return { errors };
  return {
    body: {
      name,
      address: v.address.trim() || null,
      latitude,
      longitude,
      description: v.description.trim() || null,
      priceClp: price.value,
      availability: v.availability.trim() || null,
    },
  };
}
