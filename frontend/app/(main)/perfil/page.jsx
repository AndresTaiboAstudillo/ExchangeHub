'use client';

import PerfilPage from '../../../components/PerfilPage';
import { useApp } from '../../providers';

export default function Page() {
  const { toast } = useApp();
  return <PerfilPage onToast={toast} />;
}
