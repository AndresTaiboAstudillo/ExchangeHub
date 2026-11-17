import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiMock, toDataUrl } = vi.hoisted(() => ({
  apiMock: { setAvatar: vi.fn(), removeAvatar: vi.fn() },
  toDataUrl: vi.fn(),
}));
vi.mock('../../lib/api', () => ({ api: apiMock, API_URL: 'http://api.test' }));
vi.mock('../../lib/avatarImage', () => ({
  ACCEPTED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  fileToAvatarDataUrl: toDataUrl,
}));

import AvatarEditor from './AvatarEditor';

const user = { id: 'u1', name: 'Ana', avatarUpdatedAt: null };
const withPhoto = { ...user, avatarUpdatedAt: '2026-11-18T10:00:00.000Z' };

function setup(u = user) {
  const onChange = vi.fn();
  const onToast = vi.fn();
  render(<AvatarEditor user={u} onChange={onChange} onToast={onToast} />);
  return { onChange, onToast };
}
const pick = (file) => fireEvent.change(screen.getByLabelText('Elegir foto de perfil'), { target: { files: [file] } });

beforeEach(() => vi.clearAllMocks());

describe('AvatarEditor', () => {
  it('sube la foto ya reducida y actualiza el perfil', async () => {
    toDataUrl.mockResolvedValue('data:image/jpeg;base64,QUJD');
    apiMock.setAvatar.mockResolvedValue(withPhoto);
    const { onChange, onToast } = setup();
    pick(new File(['x'], 'yo.png', { type: 'image/png' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(withPhoto));
    expect(apiMock.setAvatar).toHaveBeenCalledWith('data:image/jpeg;base64,QUJD');
    expect(onToast).toHaveBeenCalledWith('Foto actualizada ✓');
  });

  it('muestra el motivo si la imagen no sirve y no sube nada', async () => {
    toDataUrl.mockRejectedValue(new Error('Elige una imagen JPG, PNG o WebP.'));
    const { onChange, onToast } = setup();
    pick(new File(['x'], 'doc.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Elige una imagen JPG, PNG o WebP.'));
    expect(apiMock.setAvatar).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('muestra el error del servidor', async () => {
    toDataUrl.mockResolvedValue('data:image/jpeg;base64,QUJD');
    apiMock.setAvatar.mockRejectedValue(new Error('La imagen pesa demasiado'));
    const { onToast } = setup();
    pick(new File(['x'], 'yo.png', { type: 'image/png' }));
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('La imagen pesa demasiado'));
  });

  it('"Quitar foto" solo aparece si hay foto, y la elimina', async () => {
    const { rerender } = render(<AvatarEditor user={user} onChange={vi.fn()} onToast={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Quitar foto' })).toBeNull();
    rerender(<AvatarEditor user={withPhoto} onChange={vi.fn()} onToast={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Quitar foto' })).toBeInTheDocument();
  });

  it('quitar la foto llama a la API y avisa', async () => {
    apiMock.removeAvatar.mockResolvedValue(user);
    const { onChange, onToast } = setup(withPhoto);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar foto' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(user));
    expect(onToast).toHaveBeenCalledWith('Foto eliminada');
  });

  it('el botón "Cambiar foto" abre el selector de archivos', () => {
    setup();
    const input = screen.getByLabelText('Elegir foto de perfil');
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: /Cambiar foto/ }));
    expect(click).toHaveBeenCalled();
    expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
  });
});
