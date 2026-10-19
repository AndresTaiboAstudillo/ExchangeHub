'use client';

import { useState } from 'react';
import { useApp } from '../app/providers';
import { useSocial } from '../hooks/useSocial';
import AmigosTab from './comunidad/AmigosTab';
import ForoTab from './comunidad/ForoTab';

const TABS = [
  { id: 'foro', label: '💬 Foro' },
  { id: 'amigos', label: '👫 Encontrar amigos' },
];

export default function ComunidadPage({ onNewPost, onToast }) {
  const { user, refreshUser, postsVersion } = useApp();
  const [tab, setTab] = useState('foro');
  // Se carga una sola vez y se comparte entre el foro (sugerencias) y la búsqueda de amigos.
  const social = useSocial({ onFriendsChanged: refreshUser });

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-7">
      <h1 className="font-serif text-[26px] mb-1">Comunidad</h1>
      <p className="text-sm text-muted mb-6">Foro de estudiantes · Encuentra compañeros</p>

      <div role="tablist" className="flex border-b-2 border-border mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 text-sm font-medium -mb-0.5 border-b-[2.5px] whitespace-nowrap transition-colors ${
              tab === t.id ? 'text-forest-mid border-forest-mid' : 'text-muted border-transparent hover:text-ink-mid'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'foro' ? (
        <ForoTab
          social={social}
          meId={user.id}
          postsVersion={postsVersion}
          onNewPost={onNewPost}
          onToast={onToast}
          onGoAmigos={() => setTab('amigos')}
        />
      ) : (
        <AmigosTab social={social} onToast={onToast} />
      )}
    </div>
  );
}
