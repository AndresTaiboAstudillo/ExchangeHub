'use client';

import { useRouter } from 'next/navigation';
import LandingPage from '../../components/LandingPage';
import { useApp } from '../providers';

export default function LoginPage() {
  const { login } = useApp();
  const router = useRouter();

  const handleLogin = () => {
    login();
    router.push('/inicio');
  };

  return <LandingPage onLogin={handleLogin} />;
}
