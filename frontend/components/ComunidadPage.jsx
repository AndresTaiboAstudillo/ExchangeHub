'use client';

import { useState } from 'react';
import ForoTab from './comunidad/ForoTab';
import AmigosTab from './comunidad/AmigosTab';

export default function ComunidadPage({ onNewPost, onToast }) {
  const [tab, setTab] = useState('foro');

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-7">
      <h1 className="font-serif text-[26px] mb-1">Comunidad</h1>
      <p className="text-sm text-muted mb-6">Foro de estudiantes · Encuentra compañeros</p>

      <div className="flex border-b-2 border-border mb-6">
        <button
          onClick={() => setTab('foro')}
          className={`px-5 py-2.5 text-sm font-medium -mb-0.5 border-b-[2.5px] transition-colors ${
            tab === 'foro' ? 'text-forest-mid border-forest-mid' : 'text-muted border-transparent hover:text-ink-mid'
          }`}
        >
          💬 Foro
        </button>
        <button
          onClick={() => setTab('amigos')}
          className={`px-5 py-2.5 text-sm font-medium -mb-0.5 border-b-[2.5px] transition-colors ${
            tab === 'amigos' ? 'text-forest-mid border-forest-mid' : 'text-muted border-transparent hover:text-ink-mid'
          }`}
        >
          👫 Encontrar amigos
        </button>
      </div>

      {tab === 'foro' ? (
        <ForoTab onNewPost={onNewPost} onToast={onToast} onGoAmigos={() => setTab('amigos')} />
      ) : (
        <AmigosTab onToast={onToast} />
      )}
    </div>
  );
}
