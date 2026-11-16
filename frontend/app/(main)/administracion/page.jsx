'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdministracionPage from '../../../components/AdministracionPage';
import { useApp } from '../../providers';

export default function Page() {
  const { user } = useApp();
  const router = useRouter();
  const isAdmin = user?.role === 'admin';

  // Quien no es administrador no tiene nada que hacer aquí (el servidor igual rechaza cada acción).
  useEffect(() => {
    if (user && !isAdmin) router.replace('/inicio');
  }, [user, isAdmin, router]);

  return isAdmin ? <AdministracionPage /> : null;
}
