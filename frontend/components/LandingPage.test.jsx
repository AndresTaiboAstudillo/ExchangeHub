import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LandingPage from './LandingPage';

function setup(props = {}) {
  const onLogin = vi.fn().mockResolvedValue(undefined);
  const onRegister = vi.fn().mockResolvedValue(undefined);
  render(<LandingPage onLogin={onLogin} onRegister={onRegister} {...props} />);
  return { onLogin, onRegister };
}

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('LandingPage', () => {
  it('inicia sesión con el correo (sin espacios) y la contraseña', async () => {
    const { onLogin } = setup();
    type('Correo electrónico', '  ana@correo.cl ');
    type('Contraseña', 'clave-segura-123');
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith('ana@correo.cl', 'clave-segura-123'));
  });

  it('muestra el error que devuelve el servidor', async () => {
    setup({ onLogin: vi.fn().mockRejectedValue(new Error('Credenciales inválidas')) });
    type('Correo electrónico', 'ana@correo.cl');
    type('Contraseña', 'incorrecta');
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Credenciales inválidas');
  });

  it('el acceso con cuenta universitaria aún no está disponible', () => {
    setup();
    expect(screen.getByRole('button', { name: /Cuenta universitaria PUCV/ })).toBeDisabled();
  });

  describe('registro', () => {
    const openRegister = () => fireEvent.click(screen.getByRole('tab', { name: 'Registrarse' }));

    it('rechaza una contraseña de menos de 8 caracteres sin llamar al servidor', () => {
      const { onRegister } = setup();
      openRegister();
      type('Nombre completo', 'María González');
      type('Correo electrónico', 'maria@correo.cl');
      type('Contraseña', 'corta');
      fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
      expect(screen.getByRole('alert').textContent).toMatch(/al menos 8 caracteres/);
      expect(onRegister).not.toHaveBeenCalled();
    });

    it('registra con los datos limpios', async () => {
      const { onRegister } = setup();
      openRegister();
      type('Nombre completo', '  María González ');
      type('Correo electrónico', 'maria@correo.cl');
      type('Universidad de origen', ' Universidad de Barcelona ');
      type('Contraseña', 'clave-segura-123');
      fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
      await waitFor(() =>
        expect(onRegister).toHaveBeenCalledWith({
          name: 'María González',
          email: 'maria@correo.cl',
          universityOrigin: 'Universidad de Barcelona',
          password: 'clave-segura-123',
        }),
      );
    });

    it('al cambiar de pestaña se limpia el error', async () => {
      setup({ onLogin: vi.fn().mockRejectedValue(new Error('Credenciales inválidas')) });
      type('Correo electrónico', 'a@b.cl');
      type('Contraseña', 'x');
      fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
      await screen.findByRole('alert');
      openRegister();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});
