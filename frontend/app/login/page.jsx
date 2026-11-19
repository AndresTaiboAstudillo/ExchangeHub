'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LandingPage from '../../components/LandingPage';
import { useApp } from '../providers';

function LoginScreen() {
  const { login, register, loggedIn, hydrated } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const notice =
    params.get('restablecida') === '1'
      ? 'Tu contraseña cambió. Inicia sesión con la nueva.'
      : '';

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

  return <LandingPage onLogin={handleLogin} onRegister={handleRegister} notice={notice} />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}
