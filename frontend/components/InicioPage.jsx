'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../lib/api';
import {
  COMMERCE_CATEGORY_IDS,
  LODGING_CATEGORY_IDS,
  PLACE_CATEGORIES,
  fromListing,
  fromPlace,
  fromUniversity,
  fromZone,
  matchesQuery,
} from '../lib/map';
import { EMPTY_LISTING, toFormValues } from '../lib/listingForm';
import ListingCard from './inicio/ListingCard';
import { EMPTY_ZONE, ZONE_RADIUS_M, zoneToFormValues } from '../lib/zoneForm';
import ListingFormModal from './inicio/ListingFormModal';
import ZoneFormModal from './inicio/ZoneFormModal';
import MapPanel from './inicio/MapPanel';
import ReviewsModal from './inicio/ReviewsModal';

const TABS = [
  { id: 'alojamiento', label: '🏠 Alojamiento' },
  { id: 'comercio', label: '🏪 Comercios' },
  { id: 'zona', label: '🗺 Zonas' },
  { id: 'universidad', label: '🎓 Universidades' },
];
// Con la vista muy alejada la zona es enorme: se pide acercar en vez de cargar miles de comercios.
const MIN_PLACES_ZOOM = 13;
const EMPTY_PLACES = { items: [], total: 0, status: 'idle', truncated: false };
const chip = (id) => [id, PLACE_CATEGORIES[id]];
// Filtros de cada pestaña: "arriendo" son las piezas y departamentos publicados (no vienen de OpenStreetMap).
const TODOS = ['todas', { label: 'Todos', emoji: '' }];
const CHIPS = {
  comercio: [TODOS, ...COMMERCE_CATEGORY_IDS.map(chip)],
  universidad: [
    TODOS,
    ['universidad', { label: 'Universidades', emoji: '🎓' }],
    ['instituto_profesional', { label: 'Institutos', emoji: '📘' }],
    ['centro_formacion_tecnica', { label: 'CFT', emoji: '🔧' }],
  ],
  alojamiento: [TODOS, ['arriendo', { label: 'Piezas y deptos', emoji: '🏠' }], ...LODGING_CATEGORY_IDS.map(chip)],
};

/** `canManage`: la persona es administradora y puede publicar, editar y eliminar arriendos y zonas. */
export default function InicioPage({ canManage = false }) {
  // Desde Universidades se llega con ?universidad=<id>: se abre esa pestaña y se muestra la institución.
  const focusId = useSearchParams().get('universidad');
  const focusRef = useRef(focusId);
  const [tab, setTab] = useState(focusId ? 'universidad' : 'alojamiento');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('todas');
  const [selectedId, setSelectedId] = useState(null);
  const [viewport, setViewport] = useState(null); // { bbox, zoom }
  const [reviewsPlace, setReviewsPlace] = useState(null); // comercio con el detalle abierto
  // Formulario de arriendos o zonas: { kind, mode, id?, initial, key, hidden } y modo "elegir punto en el mapa".
  const [form, setForm] = useState(null);
  const [picking, setPicking] = useState(false);
  const [pickedPoint, setPickedPoint] = useState(null);

  const [listings, setListings] = useState({ items: [], status: 'loading' });
  const [zones, setZones] = useState({ items: [], status: 'loading' });
  const [universities, setUniversities] = useState({ items: [], status: 'loading' });
  const [places, setPlaces] = useState({ ...EMPTY_PLACES, tab: null });
  const cardRefs = useRef(new Map());

  useEffect(() => {
    let cancelled = false;
    api.mapListings().then(
      (rows) => !cancelled && setListings({ items: rows.map(fromListing), status: 'ready' }),
      () => !cancelled && setListings({ items: [], status: 'error' }),
    );
    api.mapZones().then(
      (rows) => !cancelled && setZones({ items: rows.map(fromZone), status: 'ready' }),
      () => !cancelled && setZones({ items: [], status: 'error' }),
    );
    api.mapUniversities().then(
      (rows) => {
        if (cancelled) return;
        const items = rows.map(fromUniversity);
        setUniversities({ items, status: 'ready' });
        if (focusRef.current && items.some((i) => i.id === focusRef.current)) setSelectedId(focusRef.current);
      },
      () => !cancelled && setUniversities({ items: [], status: 'error' }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Los comercios y hospedajes de OpenStreetMap se piden por la zona visible y la categoría elegida.
  const bbox = viewport?.bbox;
  const zoomedIn = (viewport?.zoom ?? 0) >= MIN_PLACES_ZOOM;
  const placeCategories = useMemo(() => {
    if (tab === 'comercio') return category === 'todas' ? COMMERCE_CATEGORY_IDS : [category];
    if (tab === 'alojamiento' && category !== 'arriendo') return category === 'todas' ? LODGING_CATEGORY_IDS : [category];
    return null; // zonas, o solo piezas y departamentos publicados
  }, [tab, category]);
  useEffect(() => {
    if (!placeCategories || !bbox || !zoomedIn) return undefined;
    let cancelled = false;
    api.mapPlaces({ bbox, category: placeCategories }).then(
      (res) =>
        !cancelled &&
        setPlaces({ items: res.items.map(fromPlace), total: res.total, truncated: res.truncated, status: 'ready', tab }),
      () => !cancelled && setPlaces((p) => ({ ...p, status: 'error', tab })),
    );
    return () => {
      cancelled = true;
    };
  }, [tab, placeCategories, bbox, zoomedIn]);

  // Lo que llegó de otra pestaña no se mezcla con la actual.
  const placesNow = placeCategories && places.tab === tab ? places : EMPTY_PLACES;
  const withListings = tab === 'alojamiento' && (category === 'todas' || category === 'arriendo');
  let source;
  if (tab === 'zona') source = zones;
  else if (tab === 'universidad') {
    source = {
      items: category === 'todas' ? universities.items : universities.items.filter((i) => i.categoryId === category),
      status: universities.status,
    };
  }
  else if (tab === 'comercio') source = placesNow;
  else {
    source = {
      items: [...(withListings ? listings.items : []), ...placesNow.items],
      status: withListings ? listings.status : placesNow.status === 'error' ? 'error' : 'ready',
    };
  }
  const visible = useMemo(() => source.items.filter((i) => matchesQuery(i, q)), [source.items, q]);

  const onViewportChange = useCallback((nextBbox, zoom) => setViewport({ bbox: nextBbox, zoom }), []);

  // Abre las reseñas con una copia del comercio, para que sigan abiertas aunque cambie la zona visible.
  const reviewables = useRef([]);
  useEffect(() => {
    reviewables.current = [...places.items, ...listings.items, ...zones.items];
  });
  const openReviews = useCallback((id) => {
    const place = reviewables.current.find((p) => p.id === id);
    if (place) setReviewsPlace(place);
  }, []);
  const closeReviews = useCallback(() => setReviewsPlace(null), []);

  const openCreate = (kind = 'listing') => {
    setForm({ kind, mode: 'create', initial: kind === 'zone' ? EMPTY_ZONE : EMPTY_LISTING, key: 0, hidden: false });
    setPickedPoint(null);
  };
  const openEdit = (item) => {
    const kind = item.reviewTarget === 'zone' ? 'zone' : 'listing';
    const initial = kind === 'zone' ? zoneToFormValues(item.zone) : toFormValues(item.listing);
    setForm({ kind, mode: 'edit', id: item.id, initial, key: 0, hidden: false });
    setPickedPoint({ lat: item.lat, lng: item.lng });
  };
  const closeForm = useCallback(() => {
    setForm(null);
    setPicking(false);
    setPickedPoint(null);
  }, []);
  const startPicking = (values) => {
    setForm((f) => ({ ...f, initial: values, hidden: true }));
    setPicking(true);
  };
  const cancelPicking = () => {
    setPicking(false);
    setForm((f) => (f ? { ...f, hidden: false, key: f.key + 1 } : f));
  };
  const onPick = useCallback((lat, lng) => {
    setPicking(false);
    setPickedPoint({ lat, lng });
    setForm((f) =>
      f ? { ...f, hidden: false, key: f.key + 1, initial: { ...f.initial, latitude: lat.toFixed(6), longitude: lng.toFixed(6) } } : f,
    );
  }, []);
  const saveListing = async (body) => {
    if (form.mode === 'edit') {
      const row = await api.updateListing(form.id, body);
      setListings((l) => ({ ...l, items: l.items.map((i) => (i.id === row.id ? fromListing(row) : i)) }));
      setSelectedId(row.id);
    } else {
      const row = await api.createListing(body);
      setListings((l) => ({ ...l, items: [...l.items, fromListing(row)] }));
      setSelectedId(row.id);
    }
    closeForm();
  };
  const deleteListing = async (id) => {
    await api.deleteListing(id);
    setListings((l) => ({ ...l, items: l.items.filter((i) => i.id !== id) }));
    setSelectedId((s) => (s === id ? null : s));
    setReviewsPlace((r) => (r?.id === id ? null : r));
  };
  const saveZone = async (body) => {
    const row = form.mode === 'edit' ? await api.updateZone(form.id, body) : await api.createZone(body);
    const item = fromZone(row);
    setZones((z) => ({
      ...z,
      items: form.mode === 'edit' ? z.items.map((i) => (i.id === row.id ? item : i)) : [...z.items, item],
    }));
    setSelectedId(row.id);
    closeForm();
  };
  const deleteZone = async (id) => {
    await api.deleteZone(id);
    setZones((z) => ({ ...z, items: z.items.filter((i) => i.id !== id) }));
    setSelectedId((s) => (s === id ? null : s));
    setReviewsPlace((r) => (r?.id === id ? null : r));
  };
  const updateRating = useCallback((id, rating) => {
    // La zona cambia de color con el promedio, así que se rehace desde sus datos.
    const apply = (i) =>
      i.id !== id
        ? i
        : i.kind === 'zona'
          ? fromZone({ ...i.zone, ratingAverage: rating.average, ratingCount: rating.count })
          : { ...i, rating };
    setPlaces((p) => ({ ...p, items: p.items.map(apply) }));
    setListings((l) => ({ ...l, items: l.items.map(apply) }));
    setZones((z) => ({ ...z, items: z.items.map(apply) }));
    setReviewsPlace((r) => (r?.id === id ? { ...r, rating } : r));
  }, []);

  const select = useCallback((id) => setSelectedId(id), []);
  // La tarjeta elegida (desde el mapa o desde otra página) se desplaza hasta quedar a la vista.
  useEffect(() => {
    if (selectedId) cardRefs.current.get(selectedId)?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId, tab]);

  const changeTab = (next) => {
    setTab(next);
    setCategory('todas');
    setSelectedId(null);
    setQ('');
  };

  const what = tab === 'comercio' ? 'comercios y servicios' : 'hoteles y hospedajes';
  const needsZoom = Boolean(placeCategories) && !zoomedIn;
  let status = '';
  if (placeCategories) {
    if (needsZoom) status = `Acerca el mapa para ver ${what}.`;
    else if (places.tab === tab && places.status === 'error') status = `No pudimos cargar los ${what}.`;
    else if (placesNow.truncated) status = `Mostrando ${placesNow.items.length} de ${placesNow.total}. Acerca el mapa para ver más.`;
  }

  const empty = (() => {
    if (source.status === 'loading') return 'Cargando…';
    if (source.status === 'error') return 'No pudimos cargar los datos. Inténtalo de nuevo más tarde.';
    if (needsZoom && !withListings) return `Acerca el mapa para ver ${what}.`;
    if (visible.length === 0) {
      return q ? 'Sin resultados para tu búsqueda.' : 'Aún no hay lugares en esta zona.';
    }
    return null;
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] lg:h-[calc(100vh-60px)]">
      {/* Sidebar */}
      <div className="bg-white border-r border-border flex flex-col overflow-hidden max-h-[55vh] lg:max-h-none order-2 lg:order-1">
        <div className="px-[18px] pt-[18px] pb-3.5 border-b border-border">
          <div className="relative mb-3">
            <span aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[15px] text-muted">
              🔍
            </span>
            <label htmlFor="inicio-search" className="sr-only">
              Buscar en la lista
            </label>
            <input
              id="inicio-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o dirección…"
              className="w-full pl-9 pr-3.5 py-2 border-[1.5px] border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-forest-lt focus:bg-white transition-colors"
            />
          </div>
          <div role="tablist" className="flex gap-1.5 flex-wrap">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => changeTab(t.id)}
                className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                  tab === t.id ? 'bg-forest-mid text-white' : 'bg-surface-2 text-muted'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {CHIPS[tab] && (
            <div className="flex gap-1.5 flex-wrap mt-2.5" aria-label={tab === 'comercio' ? 'Categoría de comercio' : 'Tipo de alojamiento'}>
              {CHIPS[tab].map(([id, meta]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={category === id}
                  onClick={() => setCategory(id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    category === id
                      ? 'bg-forest-mid text-white border-forest-mid'
                      : 'bg-white text-ink-mid border-border hover:bg-surface-2'
                  }`}
                >
                  {meta.emoji} {meta.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="thin-scroll flex-1 overflow-y-auto p-3.5 flex flex-col gap-3">
          {canManage && (tab === 'alojamiento' || tab === 'zona') && (
            <button
              type="button"
              onClick={() => openCreate(tab === 'zona' ? 'zone' : 'listing')}
              className="w-full px-3.5 py-2 rounded-lg text-[13px] font-semibold border-[1.5px] border-dashed border-forest-mid text-forest-mid hover:bg-surface-2"
            >
              {tab === 'zona' ? '＋ Agregar zona' : '＋ Agregar arriendo'}
            </button>
          )}
          {empty ? (
            <p className="text-sm text-muted text-center py-8">{empty}</p>
          ) : (
            visible.map((item) => (
              <div
                key={item.id}
                ref={(node) => {
                  if (node) cardRefs.current.set(item.id, node);
                  else cardRefs.current.delete(item.id);
                }}
              >
                <ListingCard
                  item={item}
                  selected={item.id === selectedId}
                  onOpen={select}
                  onReviews={openReviews}
                  onEdit={canManage ? openEdit : undefined}
                  onDelete={canManage ? (item.kind === 'zona' ? deleteZone : deleteListing) : undefined}
                />
              </div>
            ))
          )}
          <p className="text-[11px] text-muted text-center pt-1">
            Mapa y comercios: © colaboradores de{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              OpenStreetMap
            </a>{' '}
            (ODbL)
          </p>
        </div>
      </div>

      {/* Mapa */}
      <div className="h-[45vh] lg:h-auto order-1 lg:order-2 flex flex-col relative">
        {picking && (
          <div
            role="status"
            className="absolute z-[1000] top-3 left-1/2 -translate-x-1/2 w-[92%] max-w-[420px] bg-white shadow-card-lg rounded-lg px-4 py-2.5 flex items-center justify-between gap-3 text-[13px]"
          >
            <span>📍 Toca el mapa para marcar la ubicación del arriendo</span>
            <button type="button" onClick={cancelPicking} className="font-semibold text-forest-mid underline">
              Cancelar
            </button>
          </div>
        )}
        <MapPanel
          items={tab === 'comercio' && !zoomedIn ? [] : visible}
          selectedId={selectedId}
          onSelect={select}
          onViewportChange={onViewportChange}
          onReviews={openReviews}
          picking={picking}
          onPick={onPick}
          pickedPoint={pickedPoint}
          pickedRadius={form?.kind === 'zone' ? ZONE_RADIUS_M : null}
          status={status}
        />
      </div>

      {form && !form.hidden && form.kind === 'zone' && (
        <ZoneFormModal
          key={form.key}
          mode={form.mode}
          initial={form.initial}
          onSubmit={saveZone}
          onCancel={closeForm}
          onPickLocation={startPicking}
        />
      )}
      {form && !form.hidden && form.kind !== 'zone' && (
        <ListingFormModal
          key={form.key}
          mode={form.mode}
          initial={form.initial}
          onSubmit={saveListing}
          onCancel={closeForm}
          onPickLocation={startPicking}
        />
      )}
      {reviewsPlace && (
        <ReviewsModal key={reviewsPlace.id} place={reviewsPlace} onClose={closeReviews} onRatingChange={updateRating} />
      )}
    </div>
  );
}
