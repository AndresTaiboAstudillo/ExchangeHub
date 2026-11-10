'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useApp } from '../../app/providers';
import { API_URL, api, tokenStore } from '../../lib/api';
import { applyIncomingMessage, mergeMessages } from '../../lib/chat';

const ChatContext = createContext(null);
const PAGE_SIZE = 30;
const EMPTY_THREAD = { items: [], nextCursor: null, status: 'loading' };

/**
 * Conexión en tiempo real (Socket.IO), lista de amigos con su último mensaje, notificaciones y
 * la ventana de chat abierta. Se monta una sola vez para toda la zona con sesión.
 */
export function ChatProvider({ children }) {
  const { user, openDetail, toast } = useApp();
  const myId = user?.id;

  const [connected, setConnected] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const [open, setOpen] = useState(null); // { friend: {id, name}, minimized }
  const [threads, setThreads] = useState({}); // friendId -> { items, nextCursor, status }

  const socketRef = useRef(null);
  const openRef = useRef(null);
  openRef.current = open;
  const conversationsRef = useRef([]);
  conversationsRef.current = conversations;

  const viewing = (friendId) => openRef.current?.friend.id === friendId && !openRef.current.minimized;

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await api.conversations());
    } catch {
      /* se conserva la lista anterior */
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const page = await api.notifications({ limit: 20 });
      setNotifications(page.items);
      setNotifUnread(page.unreadCount);
    } catch {
      /* se conserva la lista anterior */
    }
  }, []);

  const loadThread = useCallback(async (friendId, { older = false } = {}) => {
    setThreads((t) => ({ ...t, [friendId]: { ...(t[friendId] ?? EMPTY_THREAD), status: older ? 'loading-older' : 'loading' } }));
    try {
      const cursor = older ? threadsRef.current[friendId]?.nextCursor : undefined;
      const page = await api.chatHistory(friendId, { limit: PAGE_SIZE, cursor });
      const chronological = [...page.items].reverse();
      setThreads((t) => {
        const prev = t[friendId] ?? EMPTY_THREAD;
        return {
          ...t,
          [friendId]: {
            items: mergeMessages(prev.items, chronological),
            nextCursor: older || !prev.items.length ? page.nextCursor : prev.nextCursor,
            status: 'ready',
          },
        };
      });
    } catch (err) {
      setThreads((t) => ({ ...t, [friendId]: { ...(t[friendId] ?? EMPTY_THREAD), status: 'error', error: err.message } }));
    }
  }, []);
  const threadsRef = useRef({});
  threadsRef.current = threads;

  const markRead = useCallback((friendId) => {
    setConversations((list) => list.map((c) => (c.friend.id === friendId ? { ...c, unreadCount: 0 } : c)));
    const socket = socketRef.current;
    if (socket?.connected) socket.emit('chat:read', { with: friendId });
    else api.markChatRead(friendId).catch(() => {});
  }, []);

  // Conexión: una por sesión. El token viaja en el handshake, nunca en la URL.
  useEffect(() => {
    if (!myId) return undefined;
    const socket = io(API_URL, {
      auth: (cb) => cb({ token: tokenStore.get() }),
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    let first = true;

    socket.on('connect', () => {
      setConnected(true);
      // Al reconectar se recupera lo que pudo llegar mientras no había conexión.
      loadConversations();
      loadNotifications();
      const current = openRef.current;
      if (!first && current) loadThread(current.friend.id);
      first = false;
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('chat:message', (message) => {
      const friendId = message.conversationWith;
      const visible = viewing(friendId);
      setThreads((t) => {
        const thread = t[friendId];
        if (!thread) return t;
        return { ...t, [friendId]: { ...thread, items: mergeMessages(thread.items, [message]) } };
      });
      // Mensaje de alguien que aún no está en mi lista (acaba de aceptar): se recarga la lista.
      if (!conversationsRef.current.some((c) => c.friend.id === friendId)) loadConversations();
      else setConversations((list) => applyIncomingMessage(list, message, myId, visible));
      if (visible && message.senderId !== myId) socket.emit('chat:read', { with: friendId });
    });

    socket.on('chat:read', ({ by, readAt }) => {
      // Mi amigo leyó mis mensajes: se marcan como leídos en el hilo abierto.
      setThreads((t) => {
        const thread = t[by];
        if (!thread) return t;
        return {
          ...t,
          [by]: { ...thread, items: thread.items.map((m) => (m.senderId === myId && !m.readAt ? { ...m, readAt } : m)) },
        };
      });
    });

    socket.on('chat:read-own', ({ with: friendId }) => {
      setConversations((list) => list.map((c) => (c.friend.id === friendId ? { ...c, unreadCount: 0 } : c)));
    });

    socket.on('presence', ({ userId, online }) => {
      setConversations((list) => list.map((c) => (c.friend.id === userId ? { ...c, online } : c)));
    });

    socket.on('notification:new', (notification) => {
      setNotifications((list) => [notification, ...list.filter((n) => n.id !== notification.id)].slice(0, 20));
      setNotifUnread((n) => n + 1);
      // Si alguien aceptó mi solicitud, aparece en mi lista de amigos para chatear.
      if (notification.type === 'friend_accepted') loadConversations();
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setConversations([]);
      setNotifications([]);
      setNotifUnread(0);
      setOpen(null);
      setThreads({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- los callbacks son estables
  }, [myId]);

  const openChat = useCallback(
    (friend) => {
      setOpen({ friend: { id: friend.id, name: friend.name }, minimized: false });
      loadThread(friend.id);
      markRead(friend.id);
    },
    [loadThread, markRead],
  );

  const closeChat = useCallback(() => setOpen(null), []);

  const toggleMinimize = useCallback(() => {
    setOpen((current) => {
      if (!current) return current;
      const minimized = !current.minimized;
      if (!minimized) markRead(current.friend.id);
      return { ...current, minimized };
    });
  }, [markRead]);

  const sendMessage = useCallback((friendId, body) => {
    const socket = socketRef.current;
    return new Promise((resolve, reject) => {
      if (!socket?.connected) {
        reject(new Error('Sin conexión. Reintentando…'));
        return;
      }
      socket.timeout(8000).emit('chat:send', { to: friendId, body }, (err, response) => {
        if (err) reject(new Error('El servidor no respondió. Inténtalo de nuevo.'));
        else if (!response?.ok) reject(new Error(response?.error ?? 'No se pudo enviar'));
        else resolve(response.message);
      });
    });
  }, []);

  const loadOlder = useCallback((friendId) => loadThread(friendId, { older: true }), [loadThread]);

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications((list) => list.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setNotifUnread(0);
    try {
      await api.markAllNotificationsRead();
    } catch (err) {
      toast(err.message);
      loadNotifications();
    }
  }, [loadNotifications, toast]);

  const openNotification = useCallback(
    async (notification, { navigate = true } = {}) => {
      if (!notification.readAt) {
        setNotifications((list) => list.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)));
        setNotifUnread((n) => Math.max(0, n - 1));
        api.markNotificationRead(notification.id).catch(() => {});
      }
      if (navigate && notification.postId && openDetail) openDetail(notification.postId);
    },
    [openDetail],
  );

  const unreadMessages = useMemo(() => conversations.reduce((sum, c) => sum + c.unreadCount, 0), [conversations]);
  const unreadConversations = useMemo(() => conversations.filter((c) => c.unreadCount > 0), [conversations]);

  const value = useMemo(
    () => ({
      connected,
      conversations,
      unreadMessages,
      unreadConversations,
      notifications,
      notifUnread,
      open,
      thread: open ? (threads[open.friend.id] ?? EMPTY_THREAD) : EMPTY_THREAD,
      online: open ? (conversations.find((c) => c.friend.id === open.friend.id)?.online ?? false) : false,
      openChat,
      closeChat,
      toggleMinimize,
      sendMessage,
      loadOlder,
      loadConversations,
      markAllNotificationsRead,
      openNotification,
    }),
    [
      connected, conversations, unreadMessages, unreadConversations, notifications, notifUnread, open, threads,
      openChat, closeChat, toggleMinimize, sendMessage, loadOlder, loadConversations,
      markAllNotificationsRead, openNotification,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat debe usarse dentro de <ChatProvider>');
  return ctx;
}
