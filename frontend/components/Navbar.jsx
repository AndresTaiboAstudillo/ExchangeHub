'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '../app/providers';
import { initialOf } from '../lib/format';

const NAV_ITEMS = [
  { href: '/inicio', icon: '🗺', label: 'Inicio' },
  { href: '/universidades', icon: '🎓', label: 'Universidades' },
  { href: '/comunidad', icon: '👥', label: 'Comunidad' },
  { href: '/perfil', icon: '👤', label: 'Perfil', iconOnlyOnMobile: true },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user } = useApp();

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

        <Link
          href="/perfil"
          title="Mi perfil"
          aria-label="Mi perfil"
          className="w-[34px] h-[34px] rounded-full bg-amber flex items-center justify-center font-bold text-sm text-forest flex-shrink-0"
        >
          {initialOf(user?.name)}
        </Link>
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
