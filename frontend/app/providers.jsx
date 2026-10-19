'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import DetailModal from '../components/DetailModal';
import NewPostModal from '../components/NewPostModal';
import Toast from '../components/Toast';
import { api, setUnauthorizedHandler, tokenStore } from '../lib/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null); // perfil propio (GET /users/me)
  const [hydrated, setHydrated] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [postsVersion, setPostsVersion] = useState(0);
  const [toastMsg, setToastMsg] = useState('');
  const [toastShow, setToastShow] = useState(false);
  const toastTimer = useRef(null);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    setToastShow(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastShow(false), 2800);
  }, []);

  // Al abrir la app: si hay un token guardado, recuperar la sesión para no pedir login de nuevo.
  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      if (tokenStore.get()) {
        try {
          const me = await api.me();
          if (!cancelled) setUser(me);
        } catch {
          /* token inválido (ya se limpió) o sin conexión: se muestra el login */
        }
      }
      if (!cancelled) setHydrated(true);
    }
    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  // Si el servidor rechaza el token en cualquier pantalla, se cierra la sesión.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      toast('Tu sesión expiró. Inicia sesión de nuevo.');
    });
    return () => setUnauthorizedHandler(null);
  }, [toast]);

  const login = useCallback(async (email, password) => {
    const { accessToken } = await api.login(email, password);
    tokenStore.set(accessToken);
    try {
      setUser(await api.me());
    } catch (error) {
      tokenStore.clear();
      throw error;
    }
  }, []);

  const register = useCallback(
    async ({ name, email, password, universityOrigin }) => {
      await api.register({ name, email, password, ...(universityOrigin ? { universityOrigin } : {}) });
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  // Vuelve a pedir el perfil (p. ej. para actualizar los contadores). Si falla, se conserva el actual.
  const refreshUser = useCallback(async () => {
    try {
      setUser(await api.me());
    } catch {
      /* se mantiene el perfil que ya teníamos */
    }
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        loggedIn: user !== null,
        hydrated,
        login,
        register,
        logout,
        refreshUser,
        toast,
        postsVersion,
        openDetail: setDetailId,
        closeDetail: () => setDetailId(null),
        openNewPost: () => setNewPostOpen(true),
        closeNewPost: () => setNewPostOpen(false),
      }}
    >
      {children}

      {/* Se montan una sola vez y funcionan igual en todas las rutas */}
      <DetailModal id={detailId} onClose={() => setDetailId(null)} onToast={toast} />
      <NewPostModal
        open={newPostOpen}
        onClose={() => setNewPostOpen(false)}
        onToast={toast}
        onCreated={() => setPostsVersion((v) => v + 1)}
      />
      <Toast message={toastMsg} show={toastShow} />
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>');
  return ctx;
}
