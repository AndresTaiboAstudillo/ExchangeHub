'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import { useApp } from '../providers';

export default function MainLayout({ children }) {
  const { loggedIn, hydrated } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !loggedIn) router.replace('/login');
  }, [hydrated, loggedIn, router]);

  // Evita mostrar contenido protegido antes de saber si hay sesión.
  if (!hydrated || !loggedIn) return null;

  return (
    <div>
      <Navbar />
      {/* Espacio para la barra de navegación inferior en móvil */}
      <div className="pb-20 md:pb-0">{children}</div>
    </div>
  );
}
