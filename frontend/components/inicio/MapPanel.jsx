'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { VALPARAISO, bboxParam } from '../../lib/map';
import { buildPopup } from '../../lib/mapPopup';

const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const VIEWPORT_DEBOUNCE_MS = 400;

/**
 * Mapa de Leaflet con mosaicos de OpenStreetMap. Dibuja `items` (alojamientos, comercios o zonas),
 * abre el globo del seleccionado y avisa cuando cambia la zona visible.
 */
export default function MapPanel({ items, selectedId, onSelect, onViewportChange, onReviews, status }) {
  const containerRef = useRef(null);
  const leaflet = useRef(null); // { L, map, layer, markers: Map<id, marker> }
  const callbacks = useRef({});
  useEffect(() => {
    callbacks.current = { onSelect, onViewportChange, onReviews };
  });
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  // Crea el mapa una sola vez. Leaflet toca `window`, por eso se importa solo en el navegador.
  useEffect(() => {
    let cancelled = false;
    let timer;
    let map;
    import('leaflet').then(({ default: L }) => {
      if (cancelled || !containerRef.current) return;
      map = L.map(containerRef.current, { zoomControl: false }).setView(VALPARAISO.center, VALPARAISO.zoom);
      L.control.zoom({ position: 'topright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map);
      L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
      const layer = L.layerGroup().addTo(map);
      leaflet.current = { L, map, layer, markers: new Map(), user: null, fromMap: false };

      const emit = () => {
        clearTimeout(timer);
        timer = setTimeout(
          () => callbacks.current.onViewportChange?.(bboxParam(map.getBounds()), map.getZoom()),
          VIEWPORT_DEBOUNCE_MS,
        );
      };
      map.on('moveend', emit);
      map.whenReady(() => callbacks.current.onViewportChange?.(bboxParam(map.getBounds()), map.getZoom()));
      setReady(true);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      map?.remove();
      leaflet.current = null;
    };
  }, []);

  // Redibuja los lugares cuando cambia la lista.
  useEffect(() => {
    const ctx = leaflet.current;
    if (!ready || !ctx) return;
    const { L, layer, markers } = ctx;
    // Tocar un pin no debe mover el mapa (Leaflet ya ajusta el globo); solo la lista lo hace.
    const pick = (id) => {
      ctx.fromMap = true;
      callbacks.current.onSelect?.(id);
    };
    layer.clearLayers();
    markers.clear();
    for (const item of items) {
      if (item.radius) {
        L.circle([item.lat, item.lng], {
          radius: item.radius,
          color: item.zoneColor,
          fillColor: item.zoneColor,
          fillOpacity: 0.15,
          weight: 2,
        })
          .addTo(layer)
          .on('click', () => pick(item.id));
      }
      const icon = L.divIcon({
        className: 'eh-pin',
        html: `<span class="eh-pin-body eh-pin-${item.color}"><span class="eh-pin-emoji">${item.emoji}</span></span>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -30],
      });
      const marker = L.marker([item.lat, item.lng], { icon, title: item.name, keyboard: true, alt: item.name })
        .bindPopup(() => buildPopup(item, { onReviews: (id) => callbacks.current.onReviews?.(id) }))
        .on('click', () => pick(item.id))
        .addTo(layer);
      markers.set(item.id, marker);
    }
  }, [items, ready]);

  // Resalta el lugar elegido y lo muestra (desde la lista o desde el propio mapa).
  useEffect(() => {
    const ctx = leaflet.current;
    if (!ready || !ctx || !selectedId) return;
    const marker = ctx.markers.get(selectedId);
    if (!marker) return;
    const { map } = ctx;
    const target = marker.getLatLng();
    const fromMap = ctx.fromMap;
    ctx.fromMap = false;
    if (!fromMap && !map.getBounds().pad(-0.15).contains(target)) {
      map.flyTo(target, Math.max(map.getZoom(), 15), { duration: 0.6 });
    }
    marker.openPopup();
  }, [selectedId, items, ready]);

  const locate = () => {
    const ctx = leaflet.current;
    if (!ctx || !navigator.geolocation) {
      setLocationError('Tu dispositivo no permite obtener la ubicación.');
      return;
    }
    setLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { L, map } = leaflet.current ?? {};
        setLocating(false);
        if (!map) return;
        const here = [coords.latitude, coords.longitude];
        ctx.user?.remove();
        ctx.user = L.circleMarker(here, { radius: 8, color: '#fff', weight: 3, fillColor: '#2563EB', fillOpacity: 1 })
          .bindTooltip('Estás aquí')
          .addTo(map);
        map.flyTo(here, 16, { duration: 0.8 });
      },
      () => {
        setLocating(false);
        setLocationError('No pudimos obtener tu ubicación. Revisa los permisos.');
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  return (
    <div className="relative flex-1 bg-[#E8F0E9] overflow-hidden min-h-[320px]">
      <div ref={containerRef} className="absolute inset-0" role="region" aria-label="Mapa" />

      <button
        type="button"
        onClick={locate}
        disabled={locating}
        title="Mi ubicación"
        aria-label="Mi ubicación"
        className="absolute top-[88px] right-[10px] z-[500] w-[34px] h-[34px] bg-white border-2 border-black/20 rounded flex items-center justify-center text-lg hover:bg-surface-2 disabled:opacity-60"
      >
        ◎
      </button>

      {(status || locationError) && (
        <div
          role="status"
          className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] max-w-[90%] bg-white rounded-lg shadow-card px-3.5 py-2 text-xs text-ink-mid text-center"
        >
          {locationError || status}
        </div>
      )}

      <div className="absolute bottom-6 left-3 z-[500] bg-white/95 rounded-lg px-3 py-2 shadow-card hidden sm:flex flex-col gap-1.5">
        <div className="text-[11px] font-bold text-ink-mid">Leyenda</div>
        <LegendItem color="bg-forest-mid" label="Alojamiento" />
        <LegendItem color="bg-amber" label="Comercio o servicio" />
        <LegendItem color="bg-emerald-600" label="Zona" />
        <LegendItem color="bg-blue-600" label="Universidad" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${color}`} />
      {label}
    </div>
  );
}
