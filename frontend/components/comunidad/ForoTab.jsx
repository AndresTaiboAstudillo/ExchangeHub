'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { FORUM_FILTERS } from '../../lib/categories';
import { colorFor, firstName, initialOf, shortName } from '../../lib/format';
import PostCard from './PostCard';

const EMPTY_FEED = { items: [], nextCursor: null, status: 'loading', error: '' };

export default function ForoTab({ social, meId, postsVersion, onNewPost, onToast, onGoAmigos }) {
  const [filter, setFilter] = useState('todos');
  const [feed, setFeed] = useState(EMPTY_FEED);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [adding, setAdding] = useState(null);
  const category = filter === 'todos' ? undefined : filter;

  useEffect(() => {
    let cancelled = false;
    api.posts({ category }).then(
      (page) => {
        if (!cancelled) setFeed({ items: page.items, nextCursor: page.nextCursor, status: 'ready', error: '' });
      },
      (err) => {
        if (!cancelled) setFeed((f) => ({ ...f, status: 'error', error: err.message }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [category, postsVersion, retryKey]);

  const changeFilter = (id) => {
    setFilter(id);
    setFeed(EMPTY_FEED);
  };

  const retry = () => {
    setFeed(EMPTY_FEED);
    setRetryKey((k) => k + 1);
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await api.posts({ category, cursor: feed.nextCursor });
      setFeed((f) => ({ ...f, items: [...f.items, ...page.items], nextCursor: page.nextCursor }));
    } catch (err) {
      onToast(err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const updatePost = (id, patch) =>
    setFeed((f) => ({ ...f, items: f.items.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const removePost = (id) => setFeed((f) => ({ ...f, items: f.items.filter((p) => p.id !== id) }));

  const addFriend = async (person) => {
    setAdding(person.id);
    try {
      await social.sendRequest(person.id);
      onToast(`Solicitud enviada a ${firstName(person.name)}`);
    } catch (err) {
      onToast(err.message);
    } finally {
      setAdding(null);
    }
  };

  const suggestions = social.users.filter((u) => !social.relations.has(u.id)).slice(0, 2);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div>
        <div className="flex justify-between items-center mb-3.5 flex-wrap gap-3">
          <div className="flex flex-wrap gap-2">
            {FORUM_FILTERS.map((f) => (
              <button
                type="button"
                key={f.id}
                aria-pressed={filter === f.id}
                onClick={() => changeFilter(f.id)}
                className={`px-4 py-1.5 rounded-full text-[13px] font-medium border-[1.5px] transition-colors ${
                  filter === f.id
                    ? 'bg-forest-mid border-forest-mid text-white'
                    : 'bg-white border-border text-muted hover:border-forest-lt hover:text-ink-mid'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onNewPost}
            className="px-4 py-1.5 rounded-lg text-[13px] font-semibold bg-amber text-forest hover:bg-amber-lt transition-colors whitespace-nowrap flex-shrink-0"
          >
            + Nueva publicación
          </button>
        </div>

        {feed.status === 'loading' && <p className="text-sm text-muted py-6">Cargando publicaciones…</p>}

        {feed.status === 'error' && (
          <div role="alert" className="bg-white rounded-lg p-5 shadow-card text-sm">
            <p className="text-rose-800 mb-3">{feed.error}</p>
            <button
              type="button"
              onClick={retry}
              className="px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        {feed.status === 'ready' && feed.items.length === 0 && (
          <div className="bg-white rounded-lg p-6 shadow-card text-sm text-muted">
            Todavía no hay publicaciones en esta categoría. ¡Sé la primera persona en publicar!
          </div>
        )}

        {feed.status === 'ready' &&
          feed.items.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              meId={meId}
              onToast={onToast}
              onUpdate={(patch) => updatePost(post.id, patch)}
              onRemove={() => removePost(post.id)}
            />
          ))}

        {feed.status === 'ready' && feed.nextCursor && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full justify-center px-4 py-2 rounded-lg text-[13px] font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors disabled:opacity-60"
          >
            {loadingMore ? 'Cargando…' : 'Cargar más publicaciones'}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="bg-white rounded-lg p-6 shadow-card">
          <h3 className="text-sm font-bold mb-3">Sugerencias de amigos</h3>
          <div className="flex flex-col gap-2.5">
            {social.status === 'loading' && <p className="text-[13px] text-muted">Cargando…</p>}
            {social.status === 'error' && <p className="text-[13px] text-rose-800">{social.error}</p>}
            {social.status === 'ready' && suggestions.length === 0 && (
              <p className="text-[13px] text-muted">No hay sugerencias por ahora.</p>
            )}
            {suggestions.map((person) => (
              <div key={person.id} className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: colorFor(person.id) }}
                >
                  {initialOf(person.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate">
                    {shortName(person.name)}
                    {person.countryOfOrigin ? ` — ${person.countryOfOrigin}` : ''}
                  </div>
                  <div className="text-[11px] text-muted truncate">
                    {[person.career, person.languages.map((l) => l.toUpperCase()).join(', ')]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => addFriend(person)}
                  disabled={adding === person.id}
                  className="px-3 py-1 rounded-lg text-[13px] font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors flex-shrink-0 disabled:opacity-60"
                >
                  + Agregar
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={onGoAmigos}
              className="w-full justify-center px-4 py-1.5 rounded-lg text-[13px] font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors mt-1"
            >
              Ver todos los estudiantes →
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-card">
          <h3 className="text-sm font-bold mb-2.5">Mis conexiones</h3>
          {social.friends.length === 0 ? (
            <p className="text-[13px] text-muted">Aún no tienes amigos. ¡Envía tu primera solicitud!</p>
          ) : (
            <>
              <p className="text-[13px] text-muted">
                Tienes <strong className="text-forest-mid">{social.friends.length}</strong>{' '}
                {social.friends.length === 1 ? 'amigo' : 'amigos'} en ExchangeHub
              </p>
              <div className="flex mt-2.5">
                {social.friends.slice(0, 5).map((friend, i) => (
                  <div
                    key={friend.id}
                    title={friend.name}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-white border-2 border-white ${i > 0 ? '-ml-2' : ''}`}
                    style={{ background: colorFor(friend.id) }}
                  >
                    {initialOf(friend.name)}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
