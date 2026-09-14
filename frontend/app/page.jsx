'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from './providers';

export default function RootPage() {
  const { loggedIn, hydrated } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    router.replace(loggedIn ? '/inicio' : '/login');
  }, [hydrated, loggedIn, router]);

  return null;
}
