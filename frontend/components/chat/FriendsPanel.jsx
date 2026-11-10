'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { colorFor, initialOf } from '../../lib/format';
import { previewOf } from '../../lib/chat';
import { useChat } from './ChatProvider';

/** Lista de amigos para chatear: presencia, último mensaje y no leídos. */
export default function FriendsPanel({ onClose }) {
  const { conversations, openChat, connected, loadConversations } = useChat();

  // Al abrir el panel se refresca (p. ej. si acabo de aceptar una amistad).
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return (
    <div
      role="dialog"
      aria-label="Mis amigos"
      className="fixed md:absolute inset-x-2 md:inset-x-auto md:right-0 top-[64px] md:top-[52px] md:w-[320px] bg-white rounded-lg shadow-card-lg border border-border z-[200] overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-bold">Mis amigos ({conversations.length})</h2>
        {!connected && <span className="text-[11px] text-muted">Conectando…</span>}
      </div>

      <ul className="max-h-[60vh] overflow-y-auto list-none divide-y divide-border/60">
        {conversations.map((c) => (
          <li key={c.friend.id}>
            <button
              type="button"
              onClick={() => {
                openChat(c.friend);
                onClose();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2 transition-colors"
            >
              <span
                className="relative w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
                style={{ background: colorFor(c.friend.id) }}
              >
                {initialOf(c.friend.name)}
                <span
                  role="img"
                  aria-label={c.online ? 'En línea' : 'Desconectado'}
                  className={`absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full border-2 border-white ${
                    c.online ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold truncate">{c.friend.name}</span>
                <span className={`block text-xs truncate ${c.unreadCount > 0 ? 'text-ink font-medium' : 'text-muted'}`}>
                  {c.lastMessage
                    ? `${c.lastMessage.mine ? 'Tú: ' : ''}${previewOf(c.lastMessage.body)}`
                    : 'Escribe el primer mensaje'}
                </span>
              </span>
              {c.unreadCount > 0 && (
                <span
                  aria-label={`${c.unreadCount} sin leer`}
                  className="min-w-5 h-5 px-1.5 rounded-full bg-forest-lt text-white text-[11px] font-bold flex items-center justify-center"
                >
                  {c.unreadCount}
                </span>
              )}
            </button>
          </li>
        ))}

        {conversations.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted">
            Aún no tienes amigos para chatear.{' '}
            <Link href="/comunidad" onClick={onClose} className="text-forest-mid font-semibold hover:underline">
              Buscar estudiantes
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}
