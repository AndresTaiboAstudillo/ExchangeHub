import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { api } from '../../lib/api';
import PostCard from './PostCard';

vi.mock('../../lib/api', () => ({
  api: {
    like: vi.fn(),
    unlike: vi.fn(),
    post: vi.fn(),
    createReply: vi.fn(),
    deleteReply: vi.fn(),
    deletePost: vi.fn(),
  },
}));

const basePost = {
  id: 'p1',
  category: 'arriendo',
  title: '¿Alguien conoce arriendos?',
  body: 'Busco una pieza.',
  likesCount: 12,
  likedByMe: false,
  repliesCount: 2,
  createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  author: { id: 'u1', name: 'María Jiménez', countryOfOrigin: 'España' },
};

function setup(post = {}, meId = 'otro') {
  const props = { onToast: vi.fn(), onUpdate: vi.fn(), onRemove: vi.fn() };
  render(<PostCard post={{ ...basePost, ...post }} meId={meId} {...props} />);
  return props;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('PostCard', () => {
  it('muestra autor, país, categoría y contadores', () => {
    setup();
    expect(screen.getByText('María J.')).toBeInTheDocument();
    expect(screen.getByText(/España/)).toBeInTheDocument();
    expect(screen.getByText('hace 2 horas')).toBeInTheDocument();
    expect(screen.getByText('🏠 Arriendo')).toBeInTheDocument();
    expect(screen.getByText('💬 2 respuestas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Me gusta' }).textContent).toBe('👍 12');
  });

  it('da me gusta y actualiza con la respuesta del servidor', async () => {
    api.like.mockResolvedValue({ liked: true, likesCount: 13 });
    const { onUpdate } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Me gusta' }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith({ likesCount: 13, likedByMe: true }));
    expect(api.like).toHaveBeenCalledWith('p1');
  });

  it('quita el me gusta si ya lo había dado', async () => {
    api.unlike.mockResolvedValue({ liked: false, likesCount: 11 });
    const { onUpdate } = setup({ likedByMe: true });
    fireEvent.click(screen.getByRole('button', { name: 'Quitar me gusta' }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith({ likesCount: 11, likedByMe: false }));
    expect(api.unlike).toHaveBeenCalledWith('p1');
  });

  it('avisa si el servidor rechaza el me gusta', async () => {
    api.like.mockRejectedValue(new Error('La publicación no existe'));
    const { onToast, onUpdate } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Me gusta' }));
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('La publicación no existe'));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('carga las respuestas al abrirlas y permite responder', async () => {
    api.post.mockResolvedValue({
      replies: [
        { id: 'r1', body: 'Prueba en Av. Ecuador', createdAt: basePost.createdAt, author: { id: 'u2', name: 'Carlos Pedraza', countryOfOrigin: 'Colombia' } },
      ],
    });
    api.createReply.mockResolvedValue({
      id: 'r2',
      body: 'Gracias',
      createdAt: new Date().toISOString(),
      author: { id: 'otro', name: 'Yo Mismo', countryOfOrigin: null },
    });
    const { onUpdate } = setup();

    fireEvent.click(screen.getByRole('button', { name: /Ver respuestas/ }));
    expect(await screen.findByText('Prueba en Av. Ecuador')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Escribe una respuesta'), { target: { value: '  Gracias ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Responder' }));
    expect(await screen.findByText('Gracias')).toBeInTheDocument();
    expect(api.createReply).toHaveBeenCalledWith('p1', 'Gracias');
    expect(onUpdate).toHaveBeenCalledWith({ repliesCount: 3 });
  });

  it('solo ofrece eliminar la publicación a su autor', async () => {
    setup({}, 'otro');
    expect(screen.queryByRole('button', { name: 'Eliminar' })).toBeNull();
  });

  it('el autor puede eliminar su publicación tras confirmar', async () => {
    api.deletePost.mockResolvedValue(null);
    const { onRemove } = setup({}, 'u1');
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(onRemove).toHaveBeenCalledTimes(1));
    expect(api.deletePost).toHaveBeenCalledWith('p1');
  });

  it('no elimina si el usuario cancela la confirmación', () => {
    window.confirm.mockReturnValue(false);
    const { onRemove } = setup({}, 'u1');
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(api.deletePost).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });
});
