'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import StudentProfilePage from '../../../components/StudentProfilePage';

function Content() {
  const id = useSearchParams().get('id');
  return <StudentProfilePage userId={id} />;
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted p-6">Cargando perfil…</p>}>
      <Content />
    </Suspense>
  );
}
