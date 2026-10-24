'use client';

import { useEffect, useState } from 'react';
import { useUniversities } from '../hooks/useUniversities';
import { api } from '../lib/api';
import { CATEGORY_FILTERS, OWNERSHIP_OPTIONS, formatDate } from '../lib/universities';
import UniversityCard from './universidades/UniversityCard';

export default function UniversidadesPage({ debounceMs }) {
  const u = useUniversities({ debounceMs });
  const freshness = useFreshness();

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-7">
      <h1 className="font-serif text-[26px] mb-1">Instituciones de educación superior en Chile</h1>
      <p className="text-sm text-muted mb-1">
        Catálogo oficial del Ministerio de Educación, enriquecido con datos abiertos de Wikidata
      </p>
      {freshness && (
        <p className={`text-xs mb-5 ${freshness.stale ? 'text-amber-800' : 'text-muted'}`}>{freshness.text}</p>
      )}

      <div className="flex gap-2.5 mb-4 flex-wrap">
        <div className="relative max-w-[340px] flex-1 min-w-[220px]">
          <span aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[15px] text-muted">
            🔍
          </span>
          <input
            type="search"
            aria-label="Buscar institución"
            placeholder="Buscar por nombre, sigla o tipo…"
            value={u.q}
            maxLength={100}
            onChange={(e) => u.changeQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm"
          />
        </div>
        <select
          aria-label="Tipo de institución por propiedad"
          value={u.ownership}
          onChange={(e) => u.changeOwnership(e.target.value)}
          className="max-w-[220px] px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm bg-white"
        >
          {OWNERSHIP_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2 mb-5" role="group" aria-label="Categoría">
        {CATEGORY_FILTERS.map((f) => (
          <button
            type="button"
            key={f.id}
            aria-pressed={u.category === f.id}
            onClick={() => u.changeCategory(f.id)}
            className={`px-4 py-1.5 rounded-full text-[13px] font-medium border-[1.5px] transition-colors ${
              u.category === f.id
                ? 'bg-forest-mid border-forest-mid text-white'
                : 'bg-white border-border text-muted hover:border-forest-lt hover:text-ink-mid'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {u.status === 'loading' && <p className="text-sm text-muted py-6">Cargando instituciones…</p>}

      {u.status === 'error' && (
        <div role="alert" className="bg-white rounded-lg p-5 shadow-card text-sm">
          <p className="text-rose-800 mb-3">{u.error}</p>
          <button
            type="button"
            onClick={u.retry}
            className="px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {u.status === 'ready' && (
        <>
          <p role="status" className="text-xs text-muted mb-3">
            {u.total === 0
              ? 'Sin resultados'
              : `${u.total} ${u.total === 1 ? 'institución' : 'instituciones'}${u.q.trim() ? ' · ordenadas por relevancia' : ''}`}
          </p>

          {u.total === 0 ? (
            <div className="bg-white rounded-lg p-6 shadow-card text-sm text-muted">
              No encontramos instituciones con esos criterios. Prueba con otro nombre, una sigla (por ejemplo
              «USACH») o cambia la categoría.
            </div>
          ) : (
            <div
              className={`grid gap-5 transition-opacity ${u.refreshing ? 'opacity-60' : ''}`}
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}
            >
              {u.items.map((item) => (
                <UniversityCard key={item.id} university={item} />
              ))}
            </div>
          )}

          {u.loadMoreError && (
            <p role="alert" className="text-sm text-rose-800 mt-4">
              {u.loadMoreError}
            </p>
          )}
          {u.hasMore && (
            <button
              type="button"
              onClick={u.loadMore}
              disabled={u.loadingMore}
              className="mt-6 w-full justify-center px-4 py-2 rounded-lg text-[13px] font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors disabled:opacity-60"
            >
              {u.loadingMore ? 'Cargando…' : 'Cargar más instituciones'}
            </button>
          )}
        </>
      )}

      <p className="text-[11px] text-muted mt-8">
        Fuentes: Ministerio de Educación de Chile (instituciones vigentes reconocidas) y Wikidata (CC0). Los datos de
        Wikidata cubren solo una parte de las instituciones y pueden contener errores.
      </p>
    </div>
  );
}

/** Cuándo se actualizó el catálogo por última vez. Es informativo: si falla, no se muestra nada. */
function useFreshness() {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    let cancelled = false;
    api.universitiesSources().then(
      (res) => {
        if (cancelled) return;
        const catalog = res.sources.find((s) => s.code === 'mineduc_ies');
        const date = formatDate(catalog?.lastFetchedAt);
        if (!date) return;
        setInfo({
          stale: catalog.stale,
          text: catalog.stale
            ? `Datos del Ministerio recuperados el ${date}: podrían estar desactualizados.`
            : `Datos del Ministerio actualizados el ${date}.`,
        });
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return info;
}
