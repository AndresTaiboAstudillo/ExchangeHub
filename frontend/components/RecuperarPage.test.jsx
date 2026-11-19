import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { api } from '../lib/api';
import RecuperarPage from './RecuperarPage';
import RestablecerPage from './RestablecerPage';

vi.mock('../lib/api', () => ({ api: { forgotPassword: vi.fn(), resetPassword: vi.fn() } }));

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => vi.clearAllMocks());

describe('RecuperarPage', () => {
  it('pide el enlace con el correo sin espacios y muestra un aviso neutro', async () => {
    api.forgotPassword.mockResolvedValue({ ok: true });
    render(<RecuperarPage />);
    type('Correo electrónico', '  ana@correo.cl ');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect((await screen.findByRole('status')).textContent).toMatch(/Si ana@correo.cl tiene una cuenta/);
    expect(api.forgotPassword).toHaveBeenCalledWith('ana@correo.cl');
  });

  it('muestra el error del servidor (p. ej. demasiados intentos)', async () => {
    api.forgotPassword.mockRejectedValue(new Error('Demasiados intentos. Prueba de nuevo en 15 min.'));
    render(<RecuperarPage />);
    type('Correo electrónico', 'ana@correo.cl');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Demasiados intentos/);
  });
});

describe('RestablecerPage', () => {
  const setup = (token = 'tok-abcdefghijklmnopqrstuvwxyz') => {
    const onDone = vi.fn();
    render(<RestablecerPage token={token} onDone={onDone} />);
    return onDone;
  };
  const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

  it('sin token ofrece pedir otro enlace', () => {
    setup('');
    expect(screen.getByRole('link', { name: 'Pedir un enlace nuevo' })).toBeTruthy();
  });

  it('rechaza contraseñas cortas o distintas sin llamar al servidor', () => {
    setup();
    type('Contraseña nueva', 'corta');
    type('Repite la contraseña', 'corta');
    submit();
    expect(screen.getByRole('alert').textContent).toMatch(/al menos 8/);
    type('Contraseña nueva', 'clave-nueva-123');
    type('Repite la contraseña', 'clave-nueva-124');
    submit();
    expect(screen.getByRole('alert').textContent).toMatch(/no coinciden/);
    expect(api.resetPassword).not.toHaveBeenCalled();
  });

  it('cambia la contraseña con el token y avisa que terminó', async () => {
    api.resetPassword.mockResolvedValue({ ok: true });
    const onDone = setup();
    type('Contraseña nueva', 'clave-nueva-123');
    type('Repite la contraseña', 'clave-nueva-123');
    submit();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.resetPassword).toHaveBeenCalledWith('tok-abcdefghijklmnopqrstuvwxyz', 'clave-nueva-123');
  });

  it('con un enlace vencido ofrece pedir otro', async () => {
    api.resetPassword.mockRejectedValue(new Error('El enlace no es válido o ya venció. Pide uno nuevo.'));
    setup();
    type('Contraseña nueva', 'clave-nueva-123');
    type('Repite la contraseña', 'clave-nueva-123');
    submit();
    expect((await screen.findByRole('alert')).textContent).toMatch(/ya venció/);
    expect(screen.getByRole('link', { name: 'Pedir otro enlace' })).toBeTruthy();
  });
});
