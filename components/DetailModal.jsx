'use client';

import { useState } from 'react';
import Badge from './Badge';
import { detailData } from '../data/detailData';

export default function DetailModal({ id, onClose, onToast }) {
  const [reviewText, setReviewText] = useState('');
  if (!id) return null;
  const d = detailData[id];
  if (!d) return null;

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[300] bg-black/45 backdrop-blur-sm flex items-center justify-center"
    >
      <div className="bg-white rounded-lg p-7 max-w-[600px] w-[92%] shadow-card-lg max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <h2 className="text-lg font-bold">{d.title}</h2>
          <button onClick={onClose} className="text-2xl leading-none text-muted hover:text-ink px-1.5">
            ✕
          </button>
        </div>

        <div className="w-full h-[180px] bg-surface-2 rounded-lg mb-4 flex items-center justify-center text-5xl">
          {d.emoji}
        </div>

        <div className="flex gap-3.5 mb-3.5 flex-wrap items-center">
          {d.badge && <Badge text={d.badge.text} color={d.badge.color} />}
          {d.address && <span className="text-[13px] text-muted">{d.address}</span>}
          {d.price && <span className="text-sm font-bold text-forest-mid">{d.price}</span>}
        </div>
        <p className="text-[13px] text-ink-mid mb-3.5">{d.description}</p>

        {d.reviews.length > 0 && (
          <>
            <h4 className="text-sm font-bold mb-2.5">Reseñas de estudiantes</h4>
            <div className="flex flex-col gap-3 mt-3.5">
              {d.reviews.map((r, i) => (
                <div key={i} className="p-3.5 bg-surface rounded-lg border border-border">
                  <div className="flex justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-forest-mid flex items-center justify-center text-xs text-white">
                        {r.autor[0]}
                      </div>
                      <span className="text-[13px] font-semibold">
                        {r.autor} <span className="text-muted font-normal">· {r.pais}</span>
                      </span>
                    </div>
                    <span className="text-amber text-[13px]">{r.stars}</span>
                  </div>
                  <p className="text-[13px] text-ink-mid">{r.texto}</p>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Escribe una reseña…"
            className="flex-1 px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm"
          />
          <button
            onClick={() => {
              setReviewText('');
              onToast('Reseña publicada ✓');
            }}
            className="px-3.5 py-1.5 rounded-lg text-[13px] font-semibold bg-forest-mid text-white hover:bg-forest-lt transition-colors"
          >
            Publicar
          </button>
        </div>
      </div>
    </div>
  );
}
