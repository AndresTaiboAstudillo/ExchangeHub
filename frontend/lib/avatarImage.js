// Prepara la foto de perfil en el navegador: recorte cuadrado, 256 px y JPEG liviano.
// Así se sube poco (el servidor admite hasta 64 KB) y la foto original nunca sale del dispositivo.

export const AVATAR_SIZE = 256;
export const AVATAR_MAX_BYTES = 60 * 1024; // margen bajo los 64 KB del servidor
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35];

/** Cuadrado central de una imagen de w × h. */
export function coverCrop(width, height) {
  const side = Math.min(width, height);
  return { sx: (width - side) / 2, sy: (height - side) / 2, side };
}

/** Bytes que ocupa la imagen de una data URL en base64. */
export function dataUrlBytes(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = (base64.match(/=+$/) ?? [''])[0].length;
  return Math.floor((base64.length * 3) / 4) - padding;
}

async function loadImage(file) {
  if (typeof createImageBitmap === 'function') {
    // imageOrientation respeta la rotación de las fotos tomadas con el celular.
    return createImageBitmap(file, { imageOrientation: 'from-image' });
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Archivo de imagen → data URL JPEG de 256 × 256 de hasta 60 KB.
 * Lanza un Error con un mensaje listo para mostrar.
 */
export async function fileToAvatarDataUrl(
  file,
  { load = loadImage, createCanvas = () => document.createElement('canvas') } = {},
) {
  if (!file || !ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Elige una imagen JPG, PNG o WebP.');
  }
  if (file.size > MAX_SOURCE_BYTES) throw new Error('La imagen es demasiado grande (máximo 15 MB).');

  let image;
  try {
    image = await load(file);
  } catch {
    throw new Error('No pudimos leer esa imagen. Prueba con otra.');
  }
  const width = image.width ?? image.naturalWidth;
  const height = image.height ?? image.naturalHeight;
  const { sx, sy, side } = coverCrop(width, height);

  const canvas = createCanvas();
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // las transparencias del PNG no deben quedar negras en el JPEG
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.drawImage(image, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  image.close?.();

  for (const quality of QUALITIES) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrlBytes(dataUrl) <= AVATAR_MAX_BYTES) return dataUrl;
  }
  throw new Error('No pudimos reducir la imagen lo suficiente. Prueba con otra.');
}
