'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../app/providers';
import { api } from '../lib/api';
import { colorFor, firstName, initialOf } from '../lib/format';
import { languageLabel } from '../lib/languages';
import { isLocal } from '../lib/students';
import Badge from './Badge';
import { useChat } from './chat/ChatProvider';

const secondary =
  'px-3.5 py-2 rounded-lg text-[13px] font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors disabled:opacity-60';
const primary =
  'px-3.5 py-2 rounded-lg text-[13px] font-semibold bg-forest-mid text-white hover:bg-forest-lt transition-colors disabled:opacity-60';

/** Perfil de otra persona: datos públicos y acciones según la relación (agregar, aceptar, mensaje…). */
export default function StudentProfilePage({ userId }) {
  const { user: me, toast } = useApp();
  const { openChat, loadConversations } = useChat();
  const router = useRouter();
  const [state, setState] = useState({
    status: 'loading',
    profile: null,
    error: '',
  });
  const [busy, setBusy] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!userId) return undefined;
    if (userId === me?.id) {
      router.replace('/perfil');
      return undefined;
    }
    let cancelled = false;
    api.user(userId).then(
      (profile) => {
        if (!cancelled) setState({ status: 'ready', profile, error: '' });
      },
      (err) => {
        if (!cancelled)
          setState({ status: err.status === 404 ? 'missing' : 'error', profile: null, error: err.message });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [userId, me?.id, reloadKey, router]);

  if (!userId || state.status === 'missing') return <Notice text="Este perfil no está disponible." />;
  if (state.status === 'error') return <Notice text={state.error} onRetry={load} />;
  if (state.status === 'loading') return <p className="text-sm text-muted p-6">Cargando perfil…</p>;

  const { profile } = state;
  const relation = profile.relation;
  const place = [profile.countryOfOrigin, profile.universityOrigin].filter(Boolean).join(' — ');

  const act = async (action, message) => {
    setBusy(true);
    try {
      await action();
      load();
      loadConversations();
      if (message) toast(message);
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    const text =
      relation.status === 'accepted'
        ? `¿Quitar a ${firstName(profile.name)} de tus amigos?`
        : '¿Cancelar la solicitud?';
    if (window.confirm(text)) act(() => api.removeFriendship(relation.id), 'Listo');
  };

  return (
    <div className="max-w-[900px] mx-auto px-4 md:px-6 py-7">
      <Link href="/comunidad" className="text-[13px] font-semibold text-forest-mid hover:underline">
        ← Volver a la comunidad
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 items-start mt-4">
        <div className="bg-white rounded-lg p-7 text-center shadow-card">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white mx-auto mb-3"
            style={{ background: colorFor(profile.id) }}
          >
            {initialOf(profile.name)}
          </div>
          <h1 className="text-[18px] font-bold mb-1">{profile.name}</h1>
          {place && <div className="text-[13px] text-muted mb-1">🌎 {place}</div>}
          {profile.career && <div className="text-[13px] text-muted">{profile.career}</div>}
          {isLocal(profile) && <Badge text="Local" color="green" className="mt-2" />}

          <div className="grid grid-cols-2 gap-2.5 mt-4">
            <Stat value={profile.friendsCount} label="Amigos" />
            <Stat value={profile.postsCount} label="Publicaciones" />
          </div>

          <div className="flex flex-col gap-2 mt-4">
            {!relation && (
              <button
                type="button"
                className={primary}
                disabled={busy}
                onClick={() => act(() => api.requestFriendship(profile.id), 'Solicitud enviada')}
              >
                + Agregar a amigos
              </button>
            )}
            {relation?.status === 'pending' && relation.direction === 'sent' && (
              <>
                <button type="button" className={primary} disabled>
                  Solicitud enviada
                </button>
                <button type="button" className={secondary} disabled={busy} onClick={remove}>
                  Cancelar solicitud
                </button>
              </>
            )}
            {relation?.status === 'pending' && relation.direction === 'received' && (
              <>
                <button
                  type="button"
                  className={primary}
                  disabled={busy}
                  onClick={() => act(() => api.respondFriendship(relation.id, 'accepted'), 'Ahora son amigos')}
                >
                  Aceptar solicitud
                </button>
                <button
                  type="button"
                  className={secondary}
                  disabled={busy}
                  onClick={() => act(() => api.respondFriendship(relation.id, 'rejected'), 'Solicitud rechazada')}
                >
                  Rechazar
                </button>
              </>
            )}
            {relation?.status === 'accepted' && (
              <>
                <button type="button" className={primary} onClick={() => openChat(profile)}>
                  💬 Enviar mensaje
                </button>
                <button type="button" className={secondary} disabled={busy} onClick={remove}>
                  Quitar de amigos
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Section title="Sobre mí">
            {profile.bio ? (
              <p className="text-sm text-ink-mid leading-relaxed whitespace-pre-line">{profile.bio}</p>
            ) : (
              <p className="text-xs text-muted">Esta persona aún no escribió una descripción.</p>
            )}
          </Section>

          <Section title="Idiomas">
            {profile.languages.length === 0 ? (
              <p className="text-xs text-muted">Sin idiomas indicados.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {profile.languages.map((code) => (
                  <span key={code} className="px-2.5 py-1 rounded-full bg-forest-mid text-white text-xs font-semibold">
                    {languageLabel(code)}
                  </span>
                ))}
              </div>
            )}
          </Section>

          <Section title="Intereses">
            {profile.hobbies.length === 0 ? (
              <p className="text-xs text-muted">Sin intereses indicados.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {profile.hobbies.map((h) => (
                  <span key={h} className="px-2.5 py-1 rounded-full bg-surface-2 text-ink-mid text-xs font-medium">
                    {h}
                  </span>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="bg-white rounded-lg p-6 shadow-card">
      <h2 className="text-sm font-bold mb-2.5">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ value, label }) {
  return (
    <div className="bg-surface rounded-lg p-2.5 text-center">
      <strong className="block text-xl text-forest-mid">{value}</strong>
      <span className="text-[11px] text-muted">{label}</span>
    </div>
  );
}

function Notice({ text, onRetry }) {
  return (
    <div className="max-w-[600px] mx-auto px-4 py-12 text-center">
      <p role="alert" className="text-sm text-ink-mid mb-4">
        {text}
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={secondary}>
          Reintentar
        </button>
      )}{' '}
      <Link href="/comunidad" className="text-[13px] font-semibold text-forest-mid hover:underline">
        Volver a la comunidad
      </Link>
    </div>
  );
}
