'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useApp } from '../app/providers';
import { initialOf } from '../lib/format';
import { useChat } from './chat/ChatProvider';
import FriendsPanel from './chat/FriendsPanel';
import NotificationsPanel from './chat/NotificationsPanel';

const NAV_ITEMS = [
  { href: '/inicio', icon: '🗺', label: 'Inicio' },
  { href: '/universidades', icon: '🎓', label: 'Universidades' },
  { href: '/comunidad', icon: '👥', label: 'Comunidad' },
  { href: '/perfil', icon: '👤', label: 'Perfil', iconOnlyOnMobile: true },
];

function IconButton({ label, icon, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={count > 0 ? `${label} (${count} sin leer)` : label}
      aria-expanded={active}
      className={`relative w-[34px] h-[34px] rounded-full flex items-center justify-center text-base transition-colors ${
        active ? 'bg-white/20' : 'bg-white/10 hover:bg-white/20'
      }`}
    >
      <span aria-hidden="true">{icon}</span>
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center"
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { user } = useApp();
  const { notifUnread, unreadConversations, unreadMessages } = useChat();
  // Un panel abierto pertenece a la página donde se abrió: al navegar deja de estar abierto.
  const [openPanel, setOpenPanel] = useState({ name: null, path: pathname });
  const panel = openPanel.path === pathname ? openPanel.name : null;
  const setPanel = useCallback((name) => setOpenPanel({ name, path: pathname }), [pathname]);
  const barRef = useRef(null);

  const toggle = (name) => setPanel(panel === name ? null : name);

  // Se cierra al tocar fuera, con Escape o al cambiar de página.
  useEffect(() => {
    if (!panel) return undefined;
    const onDown = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) setPanel(null);
    };
    const onKey = (e) => e.key === 'Escape' && setPanel(null);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [panel, setPanel]);

  return (
    <>
      <nav className="sticky top-0 z-[100] bg-forest flex items-center justify-between px-4 md:px-7 h-[60px]">
        <Link href="/inicio" className="font-serif text-[22px] text-white tracking-tight">
          Exchange<span className="text-amber-lt">Hub</span>
        </Link>

        <ul className="hidden md:flex gap-1 list-none">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-block px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    active ? 'bg-white/10 text-amber-lt' : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.iconOnlyOnMobile ? item.label : `${item.icon} ${item.label}`}
                </Link>
              </li>
            );
          })}
        </ul>

        <div ref={barRef} className="relative flex items-center gap-2">
          <IconButton
            label="Notificaciones"
            icon="🔔"
            count={notifUnread + unreadConversations.length}
            active={panel === 'notifications'}
            onClick={() => toggle('notifications')}
          />
          <IconButton label="Mis amigos" icon="💬" count={unreadMessages} active={panel === 'friends'} onClick={() => toggle('friends')} />
          {panel === 'notifications' && <NotificationsPanel onClose={() => setPanel(null)} />}
          {panel === 'friends' && <FriendsPanel onClose={() => setPanel(null)} />}

        <Link
          href="/perfil"
          title="Mi perfil"
          aria-label="Mi perfil"
          className="w-[34px] h-[34px] rounded-full bg-amber flex items-center justify-center font-bold text-sm text-forest flex-shrink-0"
        >
          {initialOf(user?.name)}
        </Link>
        </div>
      </nav>

      {/* En pantallas pequeñas la navegación pasa a una barra inferior, al alcance del pulgar. */}
      <ul className="md:hidden fixed bottom-0 inset-x-0 z-[100] bg-forest grid grid-cols-4 list-none pb-[env(safe-area-inset-bottom)] border-t border-white/10">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                  active ? 'text-amber-lt' : 'text-white/75'
                }`}
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
