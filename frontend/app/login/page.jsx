'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LandingPage from '../../components/LandingPage';
import { useApp } from '../providers';

export default function LoginPage() {
  const { login, register, loggedIn, hydrated } = useApp();
  const router = useRouter();

  // Si ya hay sesión, no tiene sentido mostrar el login.
  useEffect(() => {
    if (hydrated && loggedIn) router.replace('/inicio');
  }, [hydrated, loggedIn, router]);

  const handleLogin = async (email, password) => {
    await login(email, password);
    router.push('/inicio');
  };

  const handleRegister = async (data) => {
    await register(data);
    router.push('/inicio');
  };

  return <LandingPage onLogin={handleLogin} onRegister={handleRegister} />;
}
