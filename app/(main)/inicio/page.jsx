'use client';

import InicioPage from '../../../components/InicioPage';
import { useApp } from '../../providers';

export default function Page() {
  const { openDetail } = useApp();
  return <InicioPage onOpenDetail={openDetail} />;
}
