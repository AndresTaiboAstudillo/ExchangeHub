'use client';

import { Suspense } from 'react';
import { useApp } from '../../providers';
import InicioPage from '../../../components/InicioPage';

// InicioPage lee ?universidad= de la URL, y eso exige un límite de Suspense.
export default function Page() {
  const { user } = useApp();
  return (
    <Suspense fallback={<p className="text-sm text-muted p-6">Cargando mapa…</p>}>
      {/* El servidor vuelve a comprobar el rol en cada acción: esto solo muestra u oculta los botones. */}
      <InicioPage canManage={user?.role === 'admin'} />
    </Suspense>
  );
}
