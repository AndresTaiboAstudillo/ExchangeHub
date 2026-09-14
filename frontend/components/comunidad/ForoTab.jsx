'use client';

import { useState } from 'react';
import PostCard from './PostCard';
import { posts, forumFilters, friendSuggestions } from '../../data/posts';

export default function ForoTab({ onNewPost, onToast, onGoAmigos }) {
  const [filter, setFilter] = useState('todos');
  const visible = filter === 'todos' ? posts : posts.filter((p) => p.cat === filter);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div>
        <div className="flex justify-between items-center mb-3.5 flex-wrap gap-3">
          <div className="flex flex-wrap gap-2">
            {forumFilters.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
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
            onClick={onNewPost}
            className="px-4 py-1.5 rounded-lg text-[13px] font-semibold bg-amber text-forest hover:bg-amber-lt transition-colors whitespace-nowrap flex-shrink-0"
          >
            + Nueva publicación
          </button>
        </div>

        {visible.map((post) => (
          <PostCard key={post.id} post={post} onToast={onToast} />
        ))}
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="bg-white rounded-lg p-6 shadow-card">
          <h3 className="text-sm font-bold mb-3">Sugerencias de amigos</h3>
          <div className="flex flex-col gap-2.5">
            {friendSuggestions.map((f) => (
              <div key={f.name} className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: f.color }}
                >
                  {f.initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold">{f.name}</div>
                  <div className="text-[11px] text-muted">{f.career}</div>
                </div>
                <button
                  onClick={() => onToast(`Solicitud enviada a ${f.name.split(' ')[0]}`)}
                  className="px-3 py-1 rounded-lg text-[13px] font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors flex-shrink-0"
                >
                  + Agregar
                </button>
              </div>
            ))}
            <button
              onClick={onGoAmigos}
              className="w-full justify-center px-4 py-1.5 rounded-lg text-[13px] font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors mt-1"
            >
              Ver todos los estudiantes →
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-card">
          <h3 className="text-sm font-bold mb-2.5">Mis conexiones</h3>
          <p className="text-[13px] text-muted">
            Tienes <strong className="text-forest-mid">3</strong> amigos en ExchangeHub
          </p>
          <div className="flex mt-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-white border-2 border-white bg-[#1B4332]">
              C
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-white border-2 border-white bg-amber -ml-2">
              A
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-white border-2 border-white bg-[#7C3AED] -ml-2">
              S
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
