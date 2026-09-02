'use client';

import { useState } from 'react';
import ListingCard from './inicio/ListingCard';
import MapPanel from './inicio/MapPanel';
import { alojamientos, comercios, zonas } from '../data/listings';

const TABS = [
  { id: 'alojamiento', label: '🏠 Alojamiento', data: alojamientos },
  { id: 'comercio', label: '🏪 Comercios', data: comercios },
  { id: 'zona', label: '🗺 Zonas', data: zonas },
];

export default function InicioPage({ onOpenDetail }) {
  const [tab, setTab] = useState('alojamiento');
  const active = TABS.find((t) => t.id === tab);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] h-[calc(100vh-60px)]">
      {/* Sidebar */}
      <div className="bg-white border-r border-border flex flex-col overflow-hidden">
        <div className="px-[18px] pt-[18px] pb-3.5 border-b border-border">
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[15px] text-muted">🔍</span>
              <input
                type="text"
                placeholder="Buscar calle, barrio, local…"
                className="w-full pl-9 pr-3.5 py-2 border-[1.5px] border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-forest-lt focus:bg-white transition-colors"
              />
            </div>
            <button className="px-3.5 py-1.5 rounded-lg text-[13px] font-semibold bg-forest-mid text-white hover:bg-forest-lt transition-colors">
              Buscar
            </button>
          </div>
          <div className="flex gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                  tab === t.id ? 'bg-forest-mid text-white' : 'bg-surface-2 text-muted'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="thin-scroll flex-1 overflow-y-auto p-3.5 flex flex-col gap-3">
          {active.data.map((item) => (
            <ListingCard key={item.id} item={item} onOpen={onOpenDetail} />
          ))}
        </div>
      </div>

      {/* Map */}
      <MapPanel onOpen={onOpenDetail} />
    </div>
  );
}
