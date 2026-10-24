import { ALIASES } from './aliases.js';
import type { SearchDoc } from './bm25.js';

export interface SearchableUniversity {
  id: string;
  registryNumber: string | null;
  name: string;
  category: string | null;
  ownership: string | null;
  operatingStatus: string | null;
  website: string | null;
}

// Etiquetas en lenguaje de usuario (con sus siglas) para que "cft estatal" o
// "universidad privada" encuentren por tipo, no solo por nombre.
const CATEGORY_LABEL: Record<string, string> = {
  universidad: 'universidad',
  instituto_profesional: 'instituto profesional ip',
  centro_formacion_tecnica: 'centro de formación técnica cft',
};
const OWNERSHIP_LABEL: Record<string, string> = {
  estatal: 'estatal pública',
  particular_con_aportes: 'particular con aportes',
  privada: 'privada',
  otra: '',
};

export const FIELD_WEIGHTS = { name: 3, kind: 1, alias: 1 } as const;

/** Un documento por institución: el nombre pesa más que el tipo y las siglas. */
export function toSearchDoc(
  u: SearchableUniversity,
  useAliases = true,
): SearchDoc {
  return {
    id: u.id,
    fields: {
      name: u.name,
      kind: [
        CATEGORY_LABEL[u.category ?? ''] ?? '',
        OWNERSHIP_LABEL[u.ownership ?? ''] ?? '',
        u.operatingStatus?.replaceAll('_', ' ') ?? '',
        hostOf(u.website),
      ].join(' '),
      alias:
        useAliases && u.registryNumber ? (ALIASES[u.registryNumber] ?? '') : '',
    },
  };
}

function hostOf(url: string | null): string {
  if (!url) return '';
  try {
    return new URL(url).hostname
      .replace(/^www\./, '')
      .split('.')
      .slice(0, -1)
      .join(' ');
  } catch {
    return '';
  }
}
