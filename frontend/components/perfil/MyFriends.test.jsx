import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiMock, openChat } = vi.hoisted(() => ({ apiMock: { friendships: vi.fn() }, openChat: vi.fn() }));
vi.mock('../../lib/api', () => ({ api: apiMock, API_URL: 'http://api.test' }));
vi.mock('../chat/ChatProvider', () => ({ useChat: () => ({ openChat }) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }));

import MyFriends from './MyFriends';

const row = (id, name, extra = {}) => ({ id: `f-${id}`, status: 'accepted', direction: 'sent', user: { id, name, ...extra } });

beforeEach(() => vi.clearAllMocks());

describe('MyFriends', () => {
  it('pide solo las amistades aceptadas y las lista por nombre con su carrera y país', async () => {
    apiMock.friendships.mockResolvedValue([
      row('u2', 'Zoe Zapata', { career: 'Derecho', countryOfOrigin: 'Perú' }),
      row('u1', 'Álvaro Díaz', { avatarUpdatedAt: '2026-11-18T10:00:00.000Z' }),
    ]);
    render(<MyFriends refreshKey={2} />);
    expect(screen.getByText('Cargando tus amigos…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Mis amigos (2)' })).toBeInTheDocument();
    expect(apiMock.friendships).toHaveBeenCalledWith('accepted');
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText('Álvaro Díaz')).toBeInTheDocument();
    expect(within(items[0]).getByText('Estudiante')).toBeInTheDocument();
    expect(within(items[0]).getByRole('link', { name: 'Ver perfil de Álvaro Díaz' })).toBeInTheDocument();
    expect(items[0].querySelector('img').getAttribute('src')).toMatch(/\/avatars\/u1\?v=\d+$/);
    expect(within(items[1]).getByText('Derecho · Perú')).toBeInTheDocument();
    expect(items[1].querySelector('img')).toBeNull();
  });

  it('el botón de mensaje abre el chat con esa persona', async () => {
    apiMock.friendships.mockResolvedValue([row('u1', 'Ana Gómez')]);
    render(<MyFriends refreshKey={1} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar mensaje a Ana Gómez' }));
    expect(openChat).toHaveBeenCalledWith({ id: 'u1', name: 'Ana Gómez' });
  });

  it('sin amigos invita a buscar estudiantes', async () => {
    apiMock.friendships.mockResolvedValue([]);
    render(<MyFriends refreshKey={0} />);
    expect(await screen.findByText(/Aún no tienes amigos/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Encontrar estudiantes' })).toHaveAttribute('href', '/comunidad');
    expect(screen.getByRole('heading', { name: 'Mis amigos (0)' })).toBeInTheDocument();
  });

  it('muestra el error y permite reintentar', async () => {
    apiMock.friendships.mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValueOnce([row('u1', 'Ana Gómez')]);
    render(<MyFriends refreshKey={1} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Ana Gómez')).toBeInTheDocument();
  });

  it('vuelve a pedir la lista si cambia la cantidad de amigos', async () => {
    apiMock.friendships.mockResolvedValue([]);
    const { rerender } = render(<MyFriends refreshKey={0} />);
    await waitFor(() => expect(apiMock.friendships).toHaveBeenCalledTimes(1));
    rerender(<MyFriends refreshKey={1} />);
    await waitFor(() => expect(apiMock.friendships).toHaveBeenCalledTimes(2));
  });
});
