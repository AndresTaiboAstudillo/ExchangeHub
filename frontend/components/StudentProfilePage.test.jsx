import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StudentProfilePage from './StudentProfilePage';

const replace = vi.fn();
const router = { replace };
vi.mock('next/navigation', () => ({ useRouter: () => router })); // estable, como el real

const apiMock = vi.hoisted(() => ({
  user: vi.fn(),
  requestFriendship: vi.fn(),
  respondFriendship: vi.fn(),
  removeFriendship: vi.fn(),
}));
vi.mock('../lib/api', () => ({ api: apiMock }));

const app = { user: { id: 'me', name: 'Yo' }, toast: vi.fn() };
vi.mock('../app/providers', () => ({ useApp: () => app }));

const chat = { openChat: vi.fn(), loadConversations: vi.fn() };
vi.mock('./chat/ChatProvider', () => ({ useChat: () => chat }));

const profile = (extra = {}) => ({
  id: 'u1',
  name: 'Hana Lee',
  countryOfOrigin: 'Corea',
  universityOrigin: 'Yonsei',
  career: 'Diseño',
  bio: 'Me encanta el cerro Alegre',
  languages: ['ko', 'es'],
  hobbies: ['Fotografía'],
  friendsCount: 3,
  postsCount: 2,
  relation: null,
  ...extra,
});

beforeEach(() => vi.clearAllMocks());

describe('StudentProfilePage', () => {
  it('muestra los datos públicos de la persona', async () => {
    apiMock.user.mockResolvedValue(profile());
    render(<StudentProfilePage userId="u1" />);
    expect(await screen.findByRole('heading', { name: 'Hana Lee' })).toBeInTheDocument();
    expect(screen.getByText('Me encanta el cerro Alegre')).toBeInTheDocument();
    expect(screen.getByText('Coreano')).toBeInTheDocument();
    expect(screen.getByText('Fotografía')).toBeInTheDocument();
    expect(apiMock.user).toHaveBeenCalledWith('u1');
  });

  it('sin relación permite agregar y recarga el perfil', async () => {
    apiMock.user.mockResolvedValueOnce(profile()).mockResolvedValueOnce(
      profile({ relation: { id: 'f1', status: 'pending', direction: 'sent' } }),
    );
    apiMock.requestFriendship.mockResolvedValue({});
    render(<StudentProfilePage userId="u1" />);
    fireEvent.click(await screen.findByRole('button', { name: '+ Agregar a amigos' }));
    await waitFor(() => expect(apiMock.requestFriendship).toHaveBeenCalledWith('u1'));
    expect(await screen.findByRole('button', { name: 'Solicitud enviada' })).toBeDisabled();
  });

  it('con solicitud recibida permite aceptar', async () => {
    apiMock.user.mockResolvedValue(profile({ relation: { id: 'f9', status: 'pending', direction: 'received' } }));
    apiMock.respondFriendship.mockResolvedValue({});
    render(<StudentProfilePage userId="u1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Aceptar solicitud' }));
    await waitFor(() => expect(apiMock.respondFriendship).toHaveBeenCalledWith('f9', 'accepted'));
  });

  it('con un amigo ofrece enviar mensaje y abre el chat', async () => {
    apiMock.user.mockResolvedValue(profile({ relation: { id: 'f1', status: 'accepted', direction: 'sent' } }));
    render(<StudentProfilePage userId="u1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Enviar mensaje/ }));
    expect(chat.openChat).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1', name: 'Hana Lee' }));
  });

  it('un perfil inexistente u oculto muestra un aviso', async () => {
    apiMock.user.mockRejectedValue(Object.assign(new Error('Usuario no encontrado'), { status: 404 }));
    render(<StudentProfilePage userId="u1" />);
    expect(await screen.findByText('Este perfil no está disponible.')).toBeInTheDocument();
  });

  it('mi propio id redirige a Mi perfil sin pedir datos', async () => {
    render(<StudentProfilePage userId="me" />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/perfil'));
    expect(apiMock.user).not.toHaveBeenCalled();
  });
});
