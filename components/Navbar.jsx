'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/inicio', label: '🗺 Inicio' },
  { href: '/universidades', label: '🎓 Universidades' },
  { href: '/comunidad', label: '👥 Comunidad' },
  { href: '/perfil', label: 'Perfil' },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-[100] bg-forest flex items-center justify-between px-7 h-[60px]">
      <Link href="/inicio" className="font-serif text-[22px] text-white tracking-tight">
        Exchange<span className="text-amber-lt">Hub</span>
      </Link>

      <ul className="flex gap-1 list-none">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`inline-block px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-white/10 text-amber-lt' : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href="/perfil"
        title="Mi perfil"
        className="w-[34px] h-[34px] rounded-full bg-amber flex items-center justify-center font-bold text-sm text-forest flex-shrink-0"
      >
        A
      </Link>
    </nav>
  );
}
