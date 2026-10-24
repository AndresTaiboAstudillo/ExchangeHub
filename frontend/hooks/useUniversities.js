'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

const INITIAL = { items: [], total: 0, status: 'loading', error: '', loadedKey: null, loadMoreError: '' };

/**
 * Búsqueda y filtros de instituciones. El texto se envía con retardo (para no consultar en cada
 * tecla) y cada respuesta se descarta si ya cambió la búsqueda (evita mostrar resultados viejos).
 * Mientras llegan resultados nuevos se siguen mostrando los anteriores (`refreshing`).
 */
export function useUniversities({ debounceMs = 300, pageSize = 24 } = {}) {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [category, setCategory] = useState('universidad');
  const [ownership, setOwnership] = useState('');
  const [state, setState] = useState(INITIAL);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), debounceMs);
    return () => clearTimeout(timer);
  }, [q, debounceMs]);

  const paramsKey = JSON.stringify({
    q: debouncedQ || undefined,
    category: category === 'todas' ? undefined : category,
    ownership: ownership || undefined,
    limit: pageSize,
  });

  useEffect(() => {
    const current = ++generation.current;
    api.universities(JSON.parse(paramsKey)).then(
      (page) => {
        if (current !== generation.current) return;
        setState({
          items: page.items,
          total: page.total,
          status: 'ready',
          error: '',
          loadedKey: paramsKey,
          loadMoreError: '',
        });
      },
      (err) => {
        if (current !== generation.current) return;
        setState({ ...INITIAL, status: 'error', error: err.message });
      },
    );
  }, [paramsKey, retryKey]);

  const retry = useCallback(() => {
    setState(INITIAL);
    setRetryKey((k) => k + 1);
  }, []);

  const loadMore = useCallback(async () => {
    const current = generation.current;
    setLoadingMore(true);
    try {
      const page = await api.universities({ ...JSON.parse(paramsKey), offset: state.items.length });
      if (current === generation.current) {
        setState((s) => ({ ...s, items: [...s.items, ...page.items], total: page.total, loadMoreError: '' }));
      }
    } catch (err) {
      if (current === generation.current) setState((s) => ({ ...s, loadMoreError: err.message }));
    } finally {
      setLoadingMore(false);
    }
  }, [paramsKey, state.items.length]);

  return {
    q,
    category,
    ownership,
    changeQuery: setQ,
    changeCategory: setCategory,
    changeOwnership: setOwnership,
    items: state.items,
    total: state.total,
    status: state.status,
    error: state.error,
    loadMoreError: state.loadMoreError,
    refreshing: state.status === 'ready' && (state.loadedKey !== paramsKey || q.trim() !== debouncedQ),
    hasMore: state.status === 'ready' && state.items.length < state.total,
    loadingMore,
    loadMore,
    retry,
  };
}
