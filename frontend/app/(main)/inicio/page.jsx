'use client';

import { Suspense } from 'react';
import InicioPage from '../../../components/InicioPage';

// InicioPage lee ?universidad= de la URL, y eso exige un límite de Suspense.
export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted p-6">Cargando mapa…</p>}>
      <InicioPage />
    </Suspense>
  );
}
