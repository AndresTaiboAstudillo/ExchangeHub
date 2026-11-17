'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { profileHref } from '../../lib/format';
import Avatar from '../Avatar';
import { useChat } from '../chat/ChatProvider';

const secondary =
  'px-3 py-1.5 rounded-lg text-[13px] font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors';

/**
 * Lista de mis amigos (solicitudes aceptadas). `refreshKey` vuelve a pedirla cuando cambia la
 * cantidad de amigos, p. ej. tras aceptar una solicitud desde otra pantalla.
 */
export default function MyFriends({ refreshKey }) {
  const { openChat } = useChat();
  const [state, setState] = useState({ status: 'loading', friends: [], error: '' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.friendships('accepted').then(
      (rows) => {
        if (cancelled) return;
        const friends = rows
          .map((r) => r.user)
          .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
        setState({ status: 'ready', friends, error: '' });
      },
      (err) => {
        if (!cancelled) setState({ status: 'error', friends: [], error: err.message });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [refreshKey, attempt]);

  const retry = useCallback(() => {
    setState((s) => ({ ...s, status: 'loading' }));
    setAttempt((n) => n + 1);
  }, []);

  const { status, friends, error } = state;

  return (
    <section id="mis-amigos" aria-labelledby="mis-amigos-title" className="bg-white rounded-lg p-6 shadow-card mb-5 scroll-mt-20">
      <h3 id="mis-amigos-title" className="text-base font-bold mb-4 pb-2.5 border-b-[1.5px] border-border">
        Mis amigos{status === 'ready' ? ` (${friends.length})` : ''}
      </h3>

      {status === 'loading' && <p className="text-sm text-muted">Cargando tus amigos…</p>}

      {status === 'error' && (
        <div role="alert" className="text-sm">
          <p className="text-rose-800 mb-3">{error}</p>
          <button type="button" onClick={retry} className={secondary}>
            Reintentar
          </button>
        </div>
      )}

      {status === 'ready' && friends.length === 0 && (
        <p className="text-sm text-muted">
          Aún no tienes amigos en ExchangeHub.{' '}
          <Link href="/comunidad" className="text-forest-mid font-semibold hover:underline">
            Encontrar estudiantes
          </Link>
        </p>
      )}

      {status === 'ready' && friends.length > 0 && (
        <ul className="grid gap-3 list-none" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {friends.map((friend) => {
            const detail = [friend.career, friend.countryOfOrigin].filter(Boolean).join(' · ');
            return (
              <li key={friend.id} className="flex items-center gap-3 rounded-lg border-[1.5px] border-border p-3">
                <Link
                  href={profileHref(friend.id)}
                  aria-label={`Ver perfil de ${friend.name}`}
                  className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-90"
                >
                  <Avatar person={friend} className="w-11 h-11 text-base" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold truncate">{friend.name}</span>
                    <span className="block text-xs text-muted truncate">{detail || 'Estudiante'}</span>
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label={`Enviar mensaje a ${friend.name}`}
                  onClick={() => openChat(friend)}
                  className={secondary}
                >
                  💬
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
