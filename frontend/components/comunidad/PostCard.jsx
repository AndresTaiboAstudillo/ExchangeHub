'use client';

import { useState } from 'react';
import { api } from '../../lib/api';
import { categoryById } from '../../lib/categories';
import { colorFor, initialOf, shortName, timeAgo } from '../../lib/format';
import Badge from '../Badge';

export default function PostCard({ post, meId, onToast, onUpdate, onRemove }) {
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState(null); // null = todavía no se cargaron
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const category = categoryById(post.category);

  const fail = (err) => onToast(err.message);

  const toggleLike = async () => {
    try {
      const result = post.likedByMe ? await api.unlike(post.id) : await api.like(post.id);
      onUpdate({ likesCount: result.likesCount, likedByMe: result.liked });
    } catch (err) {
      fail(err);
    }
  };

  const toggleReplies = async () => {
    const opening = !showReplies;
    setShowReplies(opening);
    if (opening && replies === null) {
      setLoadingReplies(true);
      try {
        const detail = await api.post(post.id);
        setReplies(detail.replies);
      } catch (err) {
        setShowReplies(false);
        fail(err);
      } finally {
        setLoadingReplies(false);
      }
    }
  };

  const sendReply = async () => {
    const text = reply.trim();
    if (!text) return;
    setBusy(true);
    try {
      const created = await api.createReply(post.id, text);
      setReplies((list) => [...(list ?? []), created]);
      onUpdate({ repliesCount: post.repliesCount + 1 });
      setReply('');
      onToast('Respuesta publicada');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const deleteReply = async (replyId) => {
    if (!window.confirm('¿Eliminar tu respuesta?')) return;
    try {
      await api.deleteReply(post.id, replyId);
      setReplies((list) => list.filter((r) => r.id !== replyId));
      onUpdate({ repliesCount: Math.max(0, post.repliesCount - 1) });
    } catch (err) {
      fail(err);
    }
  };

  const deletePost = async () => {
    if (!window.confirm('¿Eliminar esta publicación? También se borrarán sus respuestas.')) return;
    try {
      await api.deletePost(post.id);
      onRemove();
      onToast('Publicación eliminada');
    } catch (err) {
      fail(err);
    }
  };

  const linkButton =
    'flex items-center gap-1 text-[13px] text-muted hover:text-forest-mid transition-colors';

  return (
    <article className="bg-white rounded-lg p-5 shadow-card mb-3.5 border-[1.5px] border-transparent hover:border-forest-lt transition-colors">
      <div className="flex justify-between items-start mb-2.5 gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ background: colorFor(post.author.id) }}
          >
            {initialOf(post.author.name)}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">
              {shortName(post.author.name)}
              {post.author.countryOfOrigin && (
                <span className="text-xs font-normal text-muted"> · {post.author.countryOfOrigin}</span>
              )}
            </div>
            <div className="text-xs text-muted">{timeAgo(post.createdAt)}</div>
          </div>
        </div>
        <Badge text={`${category.emoji} ${category.label}`} color={category.color} className="flex-shrink-0" />
      </div>

      <h3 className="text-[15px] font-bold mb-1.5">{post.title}</h3>
      <p className="text-[13px] text-ink-mid leading-relaxed whitespace-pre-line">{post.body}</p>

      <div className="flex items-center gap-3.5 mt-3 pt-3 border-t border-border flex-wrap">
        <span className="flex items-center gap-1 text-[13px] text-muted">💬 {post.repliesCount} respuestas</span>
        <button
          type="button"
          onClick={toggleLike}
          aria-pressed={post.likedByMe}
          aria-label={post.likedByMe ? 'Quitar me gusta' : 'Me gusta'}
          className={`${linkButton} ${post.likedByMe ? '!text-forest-mid font-semibold' : ''}`}
        >
          👍 {post.likesCount}
        </button>
        <button type="button" onClick={toggleReplies} aria-expanded={showReplies} className={linkButton}>
          {showReplies ? 'Ocultar ▴' : 'Ver respuestas ▾'}
        </button>
        {post.author.id === meId && (
          <button type="button" onClick={deletePost} className={`${linkButton} ml-auto hover:!text-rose-700`}>
            Eliminar
          </button>
        )}
      </div>

      {showReplies && (
        <div className="bg-surface rounded-lg p-3.5 mt-3 border border-border">
          {loadingReplies && <p className="text-[13px] text-muted">Cargando respuestas…</p>}
          {replies && replies.length === 0 && (
            <p className="text-[13px] text-muted pb-1">Aún no hay respuestas. ¡Escribe la primera!</p>
          )}
          {replies?.map((r) => (
            <div key={r.id} className="py-2.5 border-b border-border last:border-b-0">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                  style={{ background: colorFor(r.author.id) }}
                >
                  {initialOf(r.author.name)}
                </div>
                <strong className="text-[13px]">{shortName(r.author.name)}</strong>
                <span className="text-xs text-muted">
                  {[r.author.countryOfOrigin, timeAgo(r.createdAt)].filter(Boolean).join(' · ')}
                </span>
                {r.author.id === meId && (
                  <button
                    type="button"
                    onClick={() => deleteReply(r.id)}
                    className="ml-auto text-xs text-muted hover:text-rose-700 transition-colors"
                  >
                    Eliminar
                  </button>
                )}
              </div>
              <p className="text-[13px] text-ink-mid whitespace-pre-line">{r.body}</p>
            </div>
          ))}
          <div className="flex gap-2 mt-2.5">
            <input
              type="text"
              aria-label="Escribe una respuesta"
              value={reply}
              maxLength={5000}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendReply()}
              placeholder="Escribe una respuesta…"
              className="flex-1 min-w-0 px-3 py-2 border-[1.5px] border-border rounded-lg text-sm"
            />
            <button
              type="button"
              onClick={sendReply}
              disabled={busy || !reply.trim()}
              className="px-3.5 py-1.5 rounded-lg text-[13px] font-semibold bg-forest-mid text-white hover:bg-forest-lt transition-colors disabled:opacity-60"
            >
              Responder
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
