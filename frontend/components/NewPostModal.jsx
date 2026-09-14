'use client';

import { useState } from 'react';

export default function NewPostModal({ open, onClose, onToast }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  if (!open) return null;

  const submit = () => {
    setTitle('');
    setMessage('');
    onClose();
    onToast('Publicación creada ✓');
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[300] bg-black/45 backdrop-blur-sm flex items-center justify-center"
    >
      <div className="bg-white rounded-lg p-7 max-w-[520px] w-[92%] shadow-card-lg">
        <div className="flex justify-between items-start mb-5">
          <h2 className="text-lg font-bold">Nueva publicación</h2>
          <button onClick={onClose} className="text-2xl leading-none text-muted hover:text-ink px-1.5">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-ink-mid">Categoría</label>
            <select className="px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm bg-white">
              <option>🏠 Arriendo</option>
              <option>🎉 Salidas / Planes</option>
              <option>🎓 Evento universitario</option>
              <option>ℹ️ Info universitaria</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-ink-mid">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="¿Sobre qué quieres hablar?"
              className="px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-ink-mid">Mensaje</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe tu publicación aquí…"
              className="px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm min-h-[110px] resize-y"
            />
          </div>

          <div className="flex justify-end gap-2.5">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-amber text-forest hover:bg-amber-lt transition-colors"
            >
              Publicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
