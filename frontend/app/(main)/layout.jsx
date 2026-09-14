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

  // Avoid flashing protected content before we know the session state.
  if (!hydrated || !loggedIn) return null;

  return (
    <div>
      <Navbar />
      {children}
    </div>
  );
}
