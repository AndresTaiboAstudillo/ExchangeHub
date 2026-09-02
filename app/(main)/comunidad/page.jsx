'use client';

import ComunidadPage from '../../../components/ComunidadPage';
import { useApp } from '../../providers';

export default function Page() {
  const { openNewPost, toast } = useApp();
  return <ComunidadPage onNewPost={openNewPost} onToast={toast} />;
}
