'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import DetailModal from '../components/DetailModal';
import NewPostModal from '../components/NewPostModal';
import Toast from '../components/Toast';

const AppContext = createContext(null);

const SESSION_KEY = 'exchangehub_logged_in';

export function AppProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastShow, setToastShow] = useState(false);
  const toastTimer = useRef(null);

  // Read session on first client render so a refresh doesn't force a re-login.
  useEffect(() => {
    setLoggedIn(window.localStorage.getItem(SESSION_KEY) === '1');
    setHydrated(true);
  }, []);

  const login = () => {
    window.localStorage.setItem(SESSION_KEY, '1');
    setLoggedIn(true);
  };

  const logout = () => {
    window.localStorage.removeItem(SESSION_KEY);
    setLoggedIn(false);
  };

  const toast = (msg) => {
    setToastMsg(msg);
    setToastShow(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastShow(false), 2400);
  };

  return (
    <AppContext.Provider
      value={{
        loggedIn,
        hydrated,
        login,
        logout,
        toast,
        openDetail: setDetailId,
        closeDetail: () => setDetailId(null),
        openNewPost: () => setNewPostOpen(true),
        closeNewPost: () => setNewPostOpen(false),
      }}
    >
      {children}

      {/* Mounted once, work the same on every route */}
      <DetailModal id={detailId} onClose={() => setDetailId(null)} onToast={toast} />
      <NewPostModal open={newPostOpen} onClose={() => setNewPostOpen(false)} onToast={toast} />
      <Toast message={toastMsg} show={toastShow} />
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>');
  return ctx;
}
