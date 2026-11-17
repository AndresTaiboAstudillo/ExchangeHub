import { describe, expect, it, vi } from 'vitest';
import { AVATAR_MAX_BYTES, AVATAR_SIZE, coverCrop, dataUrlBytes, fileToAvatarDataUrl } from './avatarImage';

const fakeCanvas = (urls) => {
  const ctx = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' };
  const canvas = { width: 0, height: 0, getContext: () => ctx, toDataURL: vi.fn((type, q) => urls(q)) };
  return { canvas, ctx };
};
const file = (type = 'image/png', size = 1000) => ({ type, size });
const small = () => `data:image/jpeg;base64,${'A'.repeat(400)}`;

describe('coverCrop', () => {
  it('toma el cuadrado central', () => {
    expect(coverCrop(400, 200)).toEqual({ sx: 100, sy: 0, side: 200 });
    expect(coverCrop(200, 600)).toEqual({ sx: 0, sy: 200, side: 200 });
    expect(coverCrop(300, 300)).toEqual({ sx: 0, sy: 0, side: 300 });
  });
});

describe('dataUrlBytes', () => {
  it('calcula el tamaño decodificado', () => {
    expect(dataUrlBytes('data:image/jpeg;base64,QUJD')).toBe(3); // "ABC"
    expect(dataUrlBytes('data:image/jpeg;base64,QUI=')).toBe(2);
    expect(dataUrlBytes('data:image/jpeg;base64,QQ==')).toBe(1);
  });
});

describe('fileToAvatarDataUrl', () => {
  it('recorta al centro, escala a 256 px y devuelve un JPEG', async () => {
    const { canvas, ctx } = fakeCanvas(small);
    const out = await fileToAvatarDataUrl(file(), { load: async () => ({ width: 800, height: 400 }), createCanvas: () => canvas });
    expect(out).toBe(small());
    expect([canvas.width, canvas.height]).toEqual([AVATAR_SIZE, AVATAR_SIZE]);
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 200, 0, 400, 400, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.85);
  });

  it('baja la calidad hasta que cabe', async () => {
    const big = `data:image/jpeg;base64,${'A'.repeat(Math.ceil((AVATAR_MAX_BYTES * 4) / 3) + 100)}`;
    const { canvas } = fakeCanvas((q) => (q > 0.6 ? big : small()));
    await fileToAvatarDataUrl(file(), { load: async () => ({ width: 300, height: 300 }), createCanvas: () => canvas });
    expect(canvas.toDataURL.mock.calls.map((c) => c[1])).toEqual([0.85, 0.75, 0.65, 0.55]);
  });

  it('falla con un mensaje claro si nunca cabe', async () => {
    const big = `data:image/jpeg;base64,${'A'.repeat(200000)}`;
    const { canvas } = fakeCanvas(() => big);
    await expect(
      fileToAvatarDataUrl(file(), { load: async () => ({ width: 300, height: 300 }), createCanvas: () => canvas }),
    ).rejects.toThrow(/reducir/);
  });

  it('rechaza lo que no es JPG, PNG o WebP y los archivos enormes', async () => {
    await expect(fileToAvatarDataUrl(file('image/gif'))).rejects.toThrow(/JPG, PNG o WebP/);
    await expect(fileToAvatarDataUrl(file('image/svg+xml'))).rejects.toThrow(/JPG, PNG o WebP/);
    await expect(fileToAvatarDataUrl(null)).rejects.toThrow(/JPG, PNG o WebP/);
    await expect(fileToAvatarDataUrl(file('image/png', 16 * 1024 * 1024))).rejects.toThrow(/15 MB/);
  });

  it('avisa si el archivo no se puede leer como imagen', async () => {
    await expect(
      fileToAvatarDataUrl(file(), {
        load: async () => {
          throw new Error('corrupta');
        },
      }),
    ).rejects.toThrow(/No pudimos leer/);
  });
});
