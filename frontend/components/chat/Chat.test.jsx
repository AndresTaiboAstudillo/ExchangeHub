import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { EventEmitter } from 'node:events';
import ChatWindow from './ChatWindow';
import { ChatProvider, useChat } from './ChatProvider';
import FriendsPanel from './FriendsPanel';
import NotificationsPanel from './NotificationsPanel';

const sockets = [];
vi.mock('socket.io-client', () => ({
  io: () => {
    const s = new EventEmitter();
    s.connected = true;
    s.emitted = [];
    s.emit = (event, ...args) => {
      if (s.emitted) s.emitted.push([event, ...args]);
      return true;
    };
    s.timeout = () => ({
      emit: (event, payload, cb) => {
        s.emitted.push([event, payload]);
        cb(null, { ok: true, message: { id: 'sent', body: payload.body } });
      },
    });
    s.removeAllListeners = () => {};
    s.disconnect = vi.fn();
    s.fire = (event, ...args) => EventEmitter.prototype.emit.call(s, event, ...args);
    sockets.push(s);
    return s;
  },
}));

const apiMock = vi.hoisted(() => ({
  conversations: vi.fn(),
  notifications: vi.fn(),
  chatHistory: vi.fn(),
  markChatRead: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));
vi.mock('../../lib/api', () => ({ API_URL: 'http://api', api: apiMock, tokenStore: { get: () => 'tok' } }));

const app = { user: { id: 'me', name: 'Yo' }, openDetail: vi.fn(), toast: vi.fn() };
vi.mock('../../app/providers', () => ({ useApp: () => app }));

const carlos = { id: 'c1', name: 'Carlos P.' };

function Harness() {
  const { openChat, conversations } = useChat();
  return (
    <>
      <button onClick={() => openChat(carlos)}>abrir</button>
      <span data-testid="count">{conversations.length}</span>
      <FriendsPanel onClose={() => {}} />
      <NotificationsPanel onClose={() => {}} />
      <ChatWindow />
    </>
  );
}

const renderChat = () => render(<ChatProvider><Harness /></ChatProvider>);

beforeEach(() => {
  sockets.length = 0;
  vi.clearAllMocks();
  apiMock.conversations.mockResolvedValue([
    { friend: carlos, online: true, unreadCount: 1, lastMessage: { body: 'Oye, ¿ya encontraste arriendo?', createdAt: '2026-11-10T11:03:00Z', mine: false } },
    { friend: { id: 'h1', name: 'Hana L.' }, online: false, unreadCount: 0, lastMessage: null },
  ]);
  apiMock.notifications.mockResolvedValue({
    items: [{ id: 'n1', type: 'friend_accepted', actor: { name: 'Hana L.' }, readAt: null, createdAt: '2026-11-10T10:00:00Z' }],
    unreadCount: 1,
    nextCursor: null,
  });
  apiMock.chatHistory.mockResolvedValue({
    items: [
      { id: 'm2', senderId: 'c1', conversationWith: 'c1', body: 'segundo', createdAt: '2026-11-10T11:03:00Z', readAt: null },
      { id: 'm1', senderId: 'me', conversationWith: 'c1', body: 'primero', createdAt: '2026-11-10T11:00:00Z', readAt: null },
    ],
    nextCursor: null,
  });
  apiMock.markAllNotificationsRead.mockResolvedValue({ updated: 1 });
  apiMock.markNotificationRead.mockResolvedValue({ updated: 1 });
});

async function connected() {
  renderChat();
  await act(async () => sockets[0].fire('connect'));
  await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2'));
}

describe('chat', () => {
  it('lista amigos con presencia, último mensaje y no leídos', async () => {
    await connected();
    const panel = screen.getByRole('dialog', { name: 'Mis amigos' });
    expect(within(panel).getByText('Mis amigos (2)')).toBeInTheDocument();
    expect(within(panel).getByText('Oye, ¿ya encontraste arriendo?')).toBeInTheDocument();
    expect(within(panel).getByLabelText('1 sin leer')).toBeInTheDocument();
    expect(within(panel).getAllByRole('img').map((e) => e.getAttribute('aria-label'))).toEqual(['En línea', 'Desconectado']);
  });

  it('abre el chat, muestra el historial en orden cronológico y marca como leído', async () => {
    await connected();
    fireEvent.click(screen.getByText('abrir'));
    const log = await screen.findByRole('log', { name: 'Mensajes' });
    await waitFor(() => expect(within(log).getByText('primero')).toBeInTheDocument());
    const bodies = within(log).getAllByText(/primero|segundo/).map((e) => e.textContent);
    expect(bodies).toEqual(['primero', 'segundo']);
    expect(sockets[0].emitted).toContainEqual(['chat:read', { with: 'c1' }]);
    expect(screen.getByRole('region', { name: 'Chat con Carlos P.' })).toBeInTheDocument();
  });

  it('envía con el botón y no envía mensajes vacíos', async () => {
    await connected();
    fireEvent.click(screen.getByText('abrir'));
    await screen.findByRole('log');
    const send = screen.getByRole('button', { name: 'Enviar' });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Escribe un mensaje'), { target: { value: '  hola  ' } });
    fireEvent.click(send);
    await waitFor(() => expect(sockets[0].emitted).toContainEqual(['chat:send', { to: 'c1', body: 'hola' }]));
    await waitFor(() => expect(screen.getByLabelText('Escribe un mensaje')).toHaveValue(''));
  });

  it('un mensaje entrante aparece en vivo y, con el chat abierto, no suma no leídos', async () => {
    await connected();
    fireEvent.click(screen.getByText('abrir'));
    await screen.findByRole('log');
    await act(async () =>
      sockets[0].fire('chat:message', { id: 'm3', senderId: 'c1', conversationWith: 'c1', body: 'llegó ahora', createdAt: '2026-11-10T11:05:00Z', readAt: null }),
    );
    expect(within(screen.getByRole('log')).getByText('llegó ahora')).toBeInTheDocument();
    expect(screen.queryByLabelText('1 sin leer')).toBeNull();
  });

  it('con el chat minimizado, el mensaje entrante queda como no leído', async () => {
    await connected();
    fireEvent.click(screen.getByText('abrir'));
    await screen.findByRole('log');
    fireEvent.click(screen.getByRole('button', { name: /Minimizar chat con Carlos/ }));
    expect(screen.queryByRole('log')).toBeNull();
    await act(async () =>
      sockets[0].fire('chat:message', { id: 'm4', senderId: 'c1', conversationWith: 'c1', body: 'hey', createdAt: '2026-11-10T11:06:00Z', readAt: null }),
    );
    expect(within(screen.getByRole('dialog', { name: 'Mis amigos' })).getByLabelText('1 sin leer')).toBeInTheDocument();
  });

  it('cambia la presencia en vivo', async () => {
    await connected();
    await act(async () => sockets[0].fire('presence', { userId: 'h1', online: true }));
    const dots = within(screen.getByRole('dialog', { name: 'Mis amigos' })).getAllByRole('img');
    expect(dots.map((e) => e.getAttribute('aria-label'))).toEqual(['En línea', 'En línea']);
  });

  it('cierra el chat con la ✕', async () => {
    await connected();
    fireEvent.click(screen.getByText('abrir'));
    await screen.findByRole('log');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar chat' }));
    expect(screen.queryByRole('region', { name: /Chat con/ })).toBeNull();
  });
});

describe('notificaciones', () => {
  it('muestra mensajes sin leer y avisos, y marca todas como leídas', async () => {
    await connected();
    const panel = screen.getByRole('dialog', { name: 'Notificaciones' });
    expect(within(panel).getByText(/te envió un mensaje/)).toBeInTheDocument();
    expect(within(panel).getByText(/aceptó tu solicitud de amistad/)).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Marcar todas como leídas' }));
    await waitFor(() => expect(apiMock.markAllNotificationsRead).toHaveBeenCalled());
    expect(within(panel).getByRole('button', { name: 'Marcar todas como leídas' })).toBeDisabled();
  });

  it('una notificación en vivo se agrega arriba', async () => {
    await connected();
    await act(async () =>
      sockets[0].fire('notification:new', { id: 'n2', type: 'post_like', actor: { name: 'Priya K.' }, preview: 'El RUT', readAt: null, createdAt: new Date().toISOString(), postId: 'p1' }),
    );
    const panel = screen.getByRole('dialog', { name: 'Notificaciones' });
    expect(within(panel).getByText(/le dio like a tu publicación/)).toBeInTheDocument();
  });

  it('cada aviso con autor enlaza a su perfil', async () => {
    await connected();
    const panel = screen.getByRole('dialog', { name: 'Notificaciones' });
    const link = within(panel).getByRole('link', { name: 'Ver perfil de Carlos P.' });
    expect(link).toHaveAttribute('href', '/estudiante?id=c1');
  });

  it('el chat enlaza al perfil de la persona', async () => {
    await connected();
    fireEvent.click(screen.getByText('abrir'));
    await screen.findByRole('log');
    const chatWindow = screen.getByRole('region', { name: 'Chat con Carlos P.' });
    expect(within(chatWindow).getByRole('link', { name: 'Ver perfil de Carlos P.' })).toHaveAttribute('href', '/estudiante?id=c1');
  });

  it('al tocar una notificación de publicación se abre el detalle y se marca leída', async () => {
    await connected();
    await act(async () =>
      sockets[0].fire('notification:new', { id: 'n2', type: 'post_reply', actor: { name: 'Ana M.' }, preview: 'Me apunto', readAt: null, createdAt: new Date().toISOString(), postId: 'p9' }),
    );
    fireEvent.click(screen.getByText(/respondió tu publicación/));
    expect(app.openDetail).toHaveBeenCalledWith('p9');
    expect(apiMock.markNotificationRead).toHaveBeenCalledWith('n2');
  });
});
