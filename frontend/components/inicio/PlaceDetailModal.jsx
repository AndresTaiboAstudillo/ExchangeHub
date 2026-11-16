'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { colorFor, initialOf, profileHref, shortName, timeAgo } from '../../lib/format';
import { formatRating } from '../../lib/map';
import Badge from '../Badge';
import StarInput, { StarsDisplay } from '../StarRating';

const MAX_LENGTH = 1000;

/** Barras "5 ★ ▇▇▇ 3" con la cantidad de reseñas por nota. */
function Distribution({ summary }) {
  return (
    <div className="flex-1 min-w-[140px] flex flex-col gap-1">
      {[5, 4, 3, 2, 1].map((n) => {
        const count = summary.distribution[n - 1];
        return (
          <div key={n} className="flex items-center gap-2 text-xs text-muted">
            <span className="w-6 text-right">{n} ★</span>
            <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
              <div className="h-full bg-amber" style={{ width: `${summary.count ? (count / summary.count) * 100 : 0}%` }} />
            </div>
            <span className="w-5">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function ReviewItem({ review, onDelete, busy }) {
  const { author } = review;
  const who = (
    <>
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white flex-shrink-0"
        style={{ background: colorFor(author.id ?? 'anonimo') }}
      >
        {initialOf(author.name)}
      </div>
      <span className="text-[13px] font-semibold truncate">
        {shortName(author.name)}
        {author.countryOfOrigin && <span className="text-muted font-normal"> · {author.countryOfOrigin}</span>}
      </span>
    </>
  );
  return (
    <li className="p-3.5 bg-surface rounded-lg border border-border">
      <div className="flex justify-between items-center gap-2 mb-1">
        {author.id ? (
          <Link
            href={review.own ? '/perfil' : profileHref(author.id)}
            aria-label={`Ver perfil de ${author.name}`}
            className="flex items-center gap-2 min-w-0 hover:opacity-90"
          >
            {who}
          </Link>
        ) : (
          <div className="flex items-center gap-2 min-w-0">{who}</div>
        )}
        <StarsDisplay value={review.rating} className="text-[13px] flex-shrink-0" />
      </div>
      {review.body && <p className="text-[13px] text-ink-mid whitespace-pre-line break-words">{review.body}</p>}
      <div className="flex justify-between items-center mt-1.5 text-xs text-muted">
        <span>
          {timeAgo(review.createdAt)}
          {review.edited ? ' · editada' : ''}
        </span>
        {review.own && (
          <button type="button" onClick={onDelete} disabled={busy} className="underline hover:text-ink disabled:opacity-60">
            Eliminar
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * Detalle de un comercio con sus reseñas (la interfaz del placeholder, ahora con datos reales).
 * Se monta con `key={place.id}` para empezar limpio con cada comercio.
 */
export default function PlaceDetailModal({ place, onClose, onRatingChange }) {
  const [state, setState] = useState({ status: 'loading', summary: null, items: [], nextCursor: null });
  const [mine, setMine] = useState(null);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ kind: '', text: '' });
  const closeRef = useRef(null);

  const fail = (err) => setMessage({ kind: 'error', text: err.message || 'No pudimos completar la acción.' });

  useEffect(() => {
    let cancelled = false;
    api.placeReviews(place.id).then(
      (res) => {
        if (cancelled) return;
        setState({ status: 'ready', summary: res.summary, items: res.items, nextCursor: res.nextCursor });
        setMine(res.mine);
        setRating(res.mine?.rating ?? 0);
        setText(res.mine?.body ?? '');
      },
      () => !cancelled && setState((s) => ({ ...s, status: 'error' })),
    );
    return () => {
      cancelled = true;
    };
  }, [place.id]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sync = useCallback(
    (summary) => {
      setState((s) => ({ ...s, summary }));
      onRatingChange?.(place.id, { average: summary.average, count: summary.count });
    },
    [onRatingChange, place.id],
  );

  const loadMore = async () => {
    setBusy(true);
    try {
      const res = await api.placeReviews(place.id, { cursor: state.nextCursor });
      setState((s) => ({ ...s, items: [...s.items, ...res.items], nextCursor: res.nextCursor }));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return setMessage({ kind: 'error', text: 'Elige de 1 a 5 estrellas.' });
    setBusy(true);
    setMessage({ kind: '', text: '' });
    try {
      const res = await api.savePlaceReview(place.id, { rating, body: text.trim() || null });
      setMine(res.review);
      setState((s) => ({
        ...s,
        items: s.items.some((r) => r.id === res.review.id)
          ? s.items.map((r) => (r.id === res.review.id ? res.review : r))
          : [res.review, ...s.items],
      }));
      sync(res.summary);
      setMessage({ kind: 'ok', text: mine ? 'Reseña actualizada ✓' : 'Reseña publicada ✓' });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const removeMine = async () => {
    if (!mine) return;
    setBusy(true);
    setMessage({ kind: '', text: '' });
    try {
      await api.deleteReview(mine.id);
      const res = await api.placeReviews(place.id);
      setState({ status: 'ready', summary: res.summary, items: res.items, nextCursor: res.nextCursor });
      onRatingChange?.(place.id, { average: res.summary.average, count: res.summary.count });
      setMine(null);
      setRating(0);
      setText('');
      setMessage({ kind: 'ok', text: 'Reseña eliminada' });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const { summary } = state;
  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[1100] bg-black/45 backdrop-blur-sm flex items-center justify-center"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-detail-title"
        className="bg-white rounded-lg p-5 sm:p-7 max-w-[600px] w-[92%] shadow-card-lg max-h-[88vh] overflow-y-auto"
      >
        <div className="flex justify-between items-start mb-4 gap-3">
          <h2 id="place-detail-title" className="text-lg font-bold">
            {place.name}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-2xl leading-none text-muted hover:text-ink px-1.5"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-3.5 mb-4 flex-wrap items-center">
          <span aria-hidden="true" className="w-12 h-12 rounded-lg bg-surface-2 flex items-center justify-center text-2xl">
            {place.emoji}
          </span>
          {place.badge && <Badge text={place.badge.text} color={place.badge.color} />}
          {place.address && <span className="text-[13px] text-muted">📍 {place.address}</span>}
          {place.footer && <span className="text-[13px] text-muted">{place.footer}</span>}
        </div>

        <h3 className="text-sm font-bold mb-2.5">Reseñas de estudiantes</h3>

        {state.status === 'loading' && <p className="text-sm text-muted py-4">Cargando reseñas…</p>}
        {state.status === 'error' && (
          <p role="alert" className="text-sm text-red-600 py-4">
            No pudimos cargar las reseñas. Inténtalo de nuevo más tarde.
          </p>
        )}

        {state.status === 'ready' && (
          <>
            {summary.count > 0 ? (
              <div className="flex gap-5 items-center flex-wrap mb-3.5">
                <div className="text-center min-w-[84px]">
                  <div className="text-3xl font-bold leading-none">{formatRating(summary.average)}</div>
                  <StarsDisplay value={summary.average} className="text-sm" />
                  <div className="text-xs text-muted mt-0.5">
                    {summary.count} {summary.count === 1 ? 'reseña' : 'reseñas'}
                  </div>
                </div>
                <Distribution summary={summary} />
              </div>
            ) : (
              <p className="text-[13px] text-muted mb-3.5">Todavía no hay reseñas. ¡Sé la primera persona en opinar!</p>
            )}

            {state.items.length > 0 && (
              <ul className="flex flex-col gap-3 mb-3">
                {state.items.map((r) => (
                  <ReviewItem key={r.id} review={r} onDelete={removeMine} busy={busy} />
                ))}
              </ul>
            )}
            {state.nextCursor && (
              <button
                type="button"
                onClick={loadMore}
                disabled={busy}
                className="text-[13px] font-semibold text-forest-mid hover:underline mb-3 disabled:opacity-60"
              >
                Ver más reseñas
              </button>
            )}

            <form onSubmit={submit} className="mt-4 pt-4 border-t border-border flex flex-col gap-2.5">
              <div className="text-[13px] font-semibold">{mine ? 'Tu reseña' : 'Deja tu reseña'}</div>
              <StarInput value={rating} onChange={setRating} disabled={busy} />
              <label htmlFor="review-text" className="sr-only">
                Escribe una reseña
              </label>
              <textarea
                id="review-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={MAX_LENGTH}
                rows={3}
                placeholder="Escribe una reseña… (opcional)"
                className="w-full px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm resize-y"
              />
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="submit"
                  disabled={busy}
                  className="px-3.5 py-1.5 rounded-lg text-[13px] font-semibold bg-forest-mid text-white hover:bg-forest-lt transition-colors disabled:opacity-60"
                >
                  {mine ? 'Actualizar reseña' : 'Publicar'}
                </button>
                <span className="text-xs text-muted">
                  {text.length}/{MAX_LENGTH}
                </span>
                {message.text && (
                  <span role={message.kind === 'error' ? 'alert' : 'status'} className={`text-xs ${message.kind === 'error' ? 'text-red-600' : 'text-forest-mid'}`}>
                    {message.text}
                  </span>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
