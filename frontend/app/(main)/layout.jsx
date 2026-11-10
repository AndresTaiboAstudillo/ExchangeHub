'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import ChatWindow from '../../components/chat/ChatWindow';
import { ChatProvider } from '../../components/chat/ChatProvider';
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
    <ChatProvider>
      <Navbar />
      {/* Espacio para la barra de navegación inferior en móvil */}
      <div className="pb-20 md:pb-0">{children}</div>
      <ChatWindow />
    </ChatProvider>
  );
}
