import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdministracionPage from './AdministracionPage';

const apiMock = vi.hoisted(() => ({ adminUser: vi.fn(), adminDeleteUser: vi.fn() }));
vi.mock('../lib/api', () => ({ api: apiMock }));

const target = {
  id: 'u2',
  name: 'Ana Pérez',
  email: 'ana@correo.cl',
  role: 'user',
  content: { posts: 2, replies: 1, reviews: 0, listings: 0, messages: 7 },
};

const type = (value) => fireEvent.change(screen.getByLabelText('Correo de la persona'), { target: { value } });
const start = () => fireEvent.click(screen.getByRole('button', { name: 'Eliminar usuario' }));

beforeEach(() => vi.clearAllMocks());

describe('Administración', () => {
  it('solo ofrece eliminar a alguien por su correo', () => {
    render(<AdministracionPage />);
    expect(screen.getByRole('heading', { name: 'Administración' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar usuario' })).toBeDisabled();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('pide confirmar mostrando a quién se elimina y cuánto contenido se pierde', async () => {
    apiMock.adminUser.mockResolvedValue(target);
    render(<AdministracionPage />);
    type(' ana@correo.cl ');
    start();
    expect(await screen.findByText('¿Eliminar a Ana Pérez?')).toBeInTheDocument();
    expect(apiMock.adminUser).toHaveBeenCalledWith('ana@correo.cl');
    expect(screen.getByText(/2 publicaciones, 1 comentario, 0 reseñas, 0 arriendos, 7 mensajes/)).toBeInTheDocument();
    expect(apiMock.adminDeleteUser).not.toHaveBeenCalled(); // nada se borra sin confirmar
  });

  it('cancelar no elimina nada', async () => {
    apiMock.adminUser.mockResolvedValue(target);
    render(<AdministracionPage />);
    type('ana@correo.cl');
    start();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText('¿Eliminar a Ana Pérez?')).toBeNull();
    expect(apiMock.adminDeleteUser).not.toHaveBeenCalled();
  });

  it('al confirmar elimina, avisa y limpia el formulario', async () => {
    apiMock.adminUser.mockResolvedValue(target);
    apiMock.adminDeleteUser.mockResolvedValue({ deleted: { id: 'u2', name: 'Ana Pérez' }, content: target.content });
    render(<AdministracionPage />);
    type('ana@correo.cl');
    start();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, eliminar definitivamente' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Se eliminó a Ana Pérez y todo lo que publicó.');
    expect(apiMock.adminDeleteUser).toHaveBeenCalledWith('ana@correo.cl');
    expect(screen.queryByText('¿Eliminar a Ana Pérez?')).toBeNull();
    expect(screen.getByLabelText('Correo de la persona')).toHaveValue('');
  });

  it('muestra el error cuando el correo no existe', async () => {
    apiMock.adminUser.mockRejectedValue(new Error('No hay ningún usuario con ese correo'));
    render(<AdministracionPage />);
    type('nadie@correo.cl');
    start();
    expect(await screen.findByRole('alert')).toHaveTextContent('No hay ningún usuario con ese correo');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('muestra el motivo si el servidor rechaza la eliminación (p. ej. otro administrador)', async () => {
    apiMock.adminUser.mockResolvedValue({ ...target, role: 'admin' });
    apiMock.adminDeleteUser.mockRejectedValue(new Error('No se puede eliminar a un administrador: quítale primero el rol'));
    render(<AdministracionPage />);
    type('ana@correo.cl');
    start();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, eliminar definitivamente' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('quítale primero el rol');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sí, eliminar definitivamente' })).toBeEnabled());
  });

  it('al cambiar el correo se descarta la confirmación anterior', async () => {
    apiMock.adminUser.mockResolvedValue(target);
    render(<AdministracionPage />);
    type('ana@correo.cl');
    start();
    await screen.findByText('¿Eliminar a Ana Pérez?');
    type('otra@correo.cl');
    expect(screen.queryByText('¿Eliminar a Ana Pérez?')).toBeNull();
  });
});
