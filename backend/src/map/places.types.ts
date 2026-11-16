/** Contrato de `POST /v1/pipeline/places/run` del servicio Python. */
export interface PythonPlace {
  external_id: string;
  category: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  opening_hours: string | null;
  website: string | null;
  content_hash: string;
}

export interface PlacesPipelineResult {
  status: 'ok' | 'failed';
  source: string;
  url: string | null;
  fetched_at: string | null;
  elapsed_ms: number;
  records_received: number;
  records_valid: number;
  records_rejected: number;
  duplicates_discarded: number;
  error: string | null;
  places: PythonPlace[];
}

export const PLACE_CATEGORIES = [
  'feria',
  'supermercado',
  'minimarket',
  'panaderia',
  'verduleria',
  'farmacia',
  'lavanderia',
  'hotel',
  'hostal',
  'hospedaje',
] as const;
export const COMMERCE_CATEGORIES = PLACE_CATEGORIES.slice(0, 7);
export const LODGING_CATEGORIES = PLACE_CATEGORIES.slice(7);
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];
