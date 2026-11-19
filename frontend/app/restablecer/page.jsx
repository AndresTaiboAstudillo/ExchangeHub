'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import RestablecerPage from '../../components/RestablecerPage';

function Screen() {
  const router = useRouter();
  const token = useSearchParams().get('token') || '';
  return <RestablecerPage token={token} onDone={() => router.replace('/login?restablecida=1')} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  );
}
