/** Contrato de la respuesta de POST /v1/pipeline/universities/run (servicio Python). */

export type PipelineSource = 'mineduc_ies' | 'wikidata';
export type PipelineStatus = 'succeeded' | 'partial' | 'failed';

export interface PipelineProvenance {
  source: PipelineSource;
  external_id: string;
  url: string | null;
  fetched_at: string;
  content_hash: string;
}

export interface PipelineMatch {
  method: 'exact' | 'prefix' | 'fuzzy';
  score: number;
}

export interface PipelineUniversity {
  registry_number: string;
  name: string;
  name_key: string;
  institution_type: string;
  category:
    'universidad' | 'instituto_profesional' | 'centro_formacion_tecnica';
  ownership: 'estatal' | 'particular_con_aportes' | 'privada' | 'otra';
  operating_status: string;
  is_vigente: boolean;
  wikidata_id: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  founded_year: number | null;
  match: PipelineMatch | null;
  provenance: PipelineProvenance[];
}

export interface PipelineSourceStatus {
  code: PipelineSource;
  status: 'ok' | 'unavailable' | 'invalid_format' | 'skipped';
  url: string | null;
  edition: string | null;
  fetched_at: string | null;
  content_hash: string | null;
  records_received: number;
  records_valid: number;
  records_rejected: number;
  duplicates_discarded: number;
  elapsed_ms: number;
  notes: string[];
  error: string | null;
}

export interface PipelineResult {
  status: PipelineStatus;
  started_at: string;
  finished_at: string;
  sources: PipelineSourceStatus[];
  universities: PipelineUniversity[];
  rejected: unknown[];
  quality: Record<string, unknown>;
}

const STATUSES: ReadonlySet<string> = new Set([
  'succeeded',
  'partial',
  'failed',
]);

/** Comprobación mínima en tiempo de ejecución: no se confía a ciegas en el servicio externo. */
export function isPipelineResult(value: unknown): value is PipelineResult {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.status === 'string' &&
    STATUSES.has(v.status) &&
    Array.isArray(v.sources) &&
    Array.isArray(v.universities) &&
    typeof v.quality === 'object' &&
    v.quality !== null
  );
}
