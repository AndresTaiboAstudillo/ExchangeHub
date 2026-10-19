'use client';

import { useEffect, useId, useState } from 'react';
import { api } from '../lib/api';
import { CATEGORIES } from '../lib/categories';

export default function NewPostModal({ open, onClose, onToast, onCreated }) {
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ids = { title: useId(), heading: useId(), category: useId(), message: useId() };

  // Escape cierra el modal.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.createPost({ category, title: title.trim(), body: message.trim() });
      setTitle('');
      setMessage('');
      onClose();
      onToast('Publicación creada ✓');
      if (onCreated) onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[300] bg-black/45 backdrop-blur-sm flex items-center justify-center"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={ids.heading}
        className="bg-white rounded-lg p-7 max-w-[520px] w-[92%] max-h-[92vh] overflow-y-auto shadow-card-lg"
      >
        <div className="flex justify-between items-start mb-5">
          <h2 id={ids.heading} className="text-lg font-bold">
            Nueva publicación
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-2xl leading-none text-muted hover:text-ink px-1.5"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.category} className="text-[13px] font-semibold text-ink-mid">
              Categoría
            </label>
            <select
              id={ids.category}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm bg-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.title} className="text-[13px] font-semibold text-ink-mid">
              Título
            </label>
            <input
              id={ids.title}
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="¿Sobre qué quieres hablar?"
              className="px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.message} className="text-[13px] font-semibold text-ink-mid">
              Mensaje
            </label>
            <textarea
              id={ids.message}
              required
              maxLength={10000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe tu publicación aquí…"
              className="px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm min-h-[110px] resize-y"
            />
          </div>

          {error && (
            <p role="alert" className="text-[13px] text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-amber text-forest hover:bg-amber-lt transition-colors disabled:opacity-60"
            >
              {busy ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
