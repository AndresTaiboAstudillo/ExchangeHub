'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '../../app/providers';
import { colorFor, initialOf, profileHref } from '../../lib/format';
import { MAX_MESSAGE_LENGTH, clockTime, draftToSend } from '../../lib/chat';
import { useChat } from './ChatProvider';

/** Ventana flotante de chat 1:1. Se minimiza tocando la barra superior. */
export default function ChatWindow() {
  const { open } = useChat();
  // `key` hace que cada amigo empiece con la caja de texto y el scroll limpios.
  return open ? <ChatPanel key={open.friend.id} /> : null;
}

function ChatPanel() {
  const { user } = useApp();
  const { open, thread, online, closeChat, toggleMinimize, sendMessage, loadOlder, connected } = useChat();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const stickToBottom = useRef(true);
  const friendId = open?.friend.id;

  // Baja al último mensaje, salvo que la persona esté leyendo mensajes antiguos.
  const lastId = thread.items[thread.items.length - 1]?.id;
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [lastId, open?.minimized, friendId]);

  const { friend, minimized } = open;

  const onScroll = (e) => {
    const el = e.currentTarget;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const submit = async () => {
    const text = draftToSend(draft);
    if (!text || sending) return;
    setSending(true);
    setError('');
    stickToBottom.current = true;
    try {
      await sendMessage(friend.id, text);
      setDraft('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const loadingOlder = thread.status === 'loading-older';

  return (
    <section
      aria-label={`Chat con ${friend.name}`}
      className="fixed z-[150] right-2 md:right-6 left-2 md:left-auto bottom-[calc(64px+env(safe-area-inset-bottom))] md:bottom-0 md:w-[330px] bg-white rounded-t-lg md:rounded-b-none rounded-b-lg shadow-card-lg border border-border flex flex-col overflow-hidden"
    >
      <div className="flex items-center gap-2 bg-forest text-white pr-2">
        <button
          type="button"
          onClick={toggleMinimize}
          aria-expanded={!minimized}
          aria-label={minimized ? `Abrir chat con ${friend.name}` : `Minimizar chat con ${friend.name}`}
          className="flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2.5 text-left"
        >
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
            style={{ background: colorFor(friend.id) }}
          >
            {initialOf(friend.name)}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold truncate">{friend.name}</span>
            <span className="flex items-center gap-1.5 text-[11px] text-white/75">
              <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-gray-400'}`} />
              {online ? 'En línea' : 'Desconectado'}
            </span>
          </span>
        </button>
        <Link
          href={profileHref(friend.id)}
          aria-label={`Ver perfil de ${friend.name}`}
          title="Ver perfil"
          className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:bg-white/10 hover:text-white"
        >
          <span aria-hidden="true">👤</span>
        </Link>
        <button
          type="button"
          onClick={closeChat}
          aria-label="Cerrar chat"
          className="w-8 h-8 rounded-full text-white/80 hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>

      {!minimized && (
        <>
          <div
            ref={listRef}
            onScroll={onScroll}
            role="log"
            aria-live="polite"
            aria-label="Mensajes"
            className="h-[min(340px,50vh)] overflow-y-auto bg-surface px-3 py-3 flex flex-col gap-2"
          >
            {thread.nextCursor && (
              <button
                type="button"
                disabled={loadingOlder}
                onClick={() => {
                  stickToBottom.current = false;
                  loadOlder(friend.id);
                }}
                className="self-center text-xs font-semibold text-forest-mid hover:underline disabled:text-muted"
              >
                {loadingOlder ? 'Cargando…' : 'Ver mensajes anteriores'}
              </button>
            )}
            {thread.status === 'loading' && <p className="text-xs text-muted text-center py-4">Cargando mensajes…</p>}
            {thread.status === 'error' && (
              <p role="alert" className="text-xs text-rose-800 text-center py-4">
                {thread.error}
              </p>
            )}
            {thread.status === 'ready' && thread.items.length === 0 && (
              <p className="text-xs text-muted text-center py-6">Di hola a {friend.name} 👋</p>
            )}

            {thread.items.map((m) => {
              const mine = m.senderId === user.id;
              return (
                <div key={m.id} className={`flex flex-col max-w-[82%] ${mine ? 'self-end items-end' : 'self-start items-start'}`}>
                  <div
                    className={`px-3 py-2 rounded-2xl text-[13px] leading-snug whitespace-pre-wrap break-words ${
                      mine ? 'bg-forest-mid text-white rounded-br-sm' : 'bg-white text-ink rounded-bl-sm shadow-card'
                    }`}
                  >
                    {m.body}
                  </div>
                  <span className="text-[10px] text-muted mt-0.5">
                    {clockTime(m.createdAt)}
                    {mine && (m.readAt ? ' · Leído' : '')}
                  </span>
                </div>
              );
            })}
          </div>

          {error && (
            <p role="alert" className="px-3 py-1.5 text-xs text-rose-800 bg-rose-50">
              {error}
            </p>
          )}

          <form
            className="flex items-center gap-2 p-2.5 border-t border-border bg-white"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label htmlFor="chat-input" className="sr-only">
              Escribe un mensaje
            </label>
            <input
              id="chat-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_MESSAGE_LENGTH}
              autoComplete="off"
              placeholder={connected ? 'Escribe un mensaje…' : 'Conectando…'}
              className="flex-1 min-w-0 px-3 py-2 border-[1.5px] border-border rounded-full text-sm"
            />
            <button
              type="submit"
              aria-label="Enviar"
              disabled={sending || !connected || draftToSend(draft) === null}
              className="w-9 h-9 rounded-full bg-forest-mid text-white flex items-center justify-center hover:bg-forest-lt transition-colors disabled:opacity-50"
            >
              ➤
            </button>
          </form>
        </>
      )}
    </section>
  );
}
