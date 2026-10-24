/**
 * Evaluación de la calidad de la búsqueda (requisito 7) sobre el catálogo real del Mineduc.
 * No usa base de datos: construye el mismo índice que el servicio con los registros del fixture.
 *
 *   npx vitest run test/eval                       → verifica etiquetas y umbrales mínimos
 *   EVAL_REPORT_PATH=resultado.md npx vitest run test/eval   → además escribe el informe
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Bm25Index } from '../../src/universities/search/bm25.js';
import { nameKey } from '../../src/universities/search/normalize.js';
import {
  FIELD_WEIGHTS,
  toSearchDoc,
} from '../../src/universities/search/university-document.js';
import {
  mean,
  precisionAtK,
  recallAtK,
  reciprocalRank,
  rPrecision,
} from '../../src/universities/evaluation/metrics.js';
import type { PipelineResult } from '../../src/universities/pipeline.types.js';

interface Consulta {
  q: string;
  tipo: 'nombre' | 'tipo' | 'navegacional' | 'mixta' | 'sigla' | 'semantica';
  relevantes: string[];
}

const read = (rel: string) =>
  readFileSync(new URL(rel, import.meta.url), 'utf8');
const pipeline = JSON.parse(
  read('../fixtures/pipeline-result.json'),
) as PipelineResult;
const { criterio, consultas } = JSON.parse(read('./relevance.json')) as {
  criterio: string;
  consultas: Consulta[];
};

// Se evalúa solo sobre el catálogo oficial (completo y real). Las filas de Wikidata del fixture son
// en parte sintéticas, así que se omite el sitio web para no contaminar la medición.
const rows = pipeline.universities.map((u) => ({
  id: u.registry_number,
  registryNumber: u.registry_number,
  name: u.name,
  category: u.category,
  ownership: u.ownership,
  operatingStatus: u.operating_status,
  website: null,
}));

function buildIndex(useAliases: boolean) {
  const started = performance.now();
  const index = new Bm25Index(
    rows.map((r) => toSearchDoc(r, useAliases)),
    { weights: FIELD_WEIGHTS },
  );
  return { index, buildMs: performance.now() - started };
}

interface Row {
  q: string;
  tipo: string;
  relevantes: number;
  p5: number;
  np5: number;
  r5: number;
  p10: number;
  np10: number;
  r10: number;
  rr: number;
  rprec: number;
}

function evaluate(useAliases: boolean) {
  const { index, buildMs } = buildIndex(useAliases);
  const timings: number[] = [];
  const results: Row[] = consultas.map((c) => {
    const t0 = performance.now();
    const ranked = index.search(c.q, 50).map((h) => h.id);
    timings.push(performance.now() - t0);
    const rel = new Set(c.relevantes);
    return {
      q: c.q,
      tipo: c.tipo,
      relevantes: rel.size,
      p5: precisionAtK(ranked, rel, 5),
      np5: precisionAtK(ranked, rel, 5) / Math.min(1, rel.size / 5),
      r5: recallAtK(ranked, rel, 5),
      p10: precisionAtK(ranked, rel, 10),
      np10: precisionAtK(ranked, rel, 10) / Math.min(1, rel.size / 10),
      r10: recallAtK(ranked, rel, 10),
      rr: reciprocalRank(ranked, rel),
      rprec: rPrecision(ranked, rel),
    };
  });
  const summary = (subset: Row[]) => ({
    n: subset.length,
    p5: mean(subset.map((r) => r.p5)),
    np5: mean(subset.map((r) => r.np5)),
    r5: mean(subset.map((r) => r.r5)),
    p10: mean(subset.map((r) => r.p10)),
    np10: mean(subset.map((r) => r.np10)),
    r10: mean(subset.map((r) => r.r10)),
    mrr: mean(subset.map((r) => r.rr)),
    rprec: mean(subset.map((r) => r.rprec)),
  });
  return {
    results,
    all: summary(results),
    byType: (tipo: string) => summary(results.filter((r) => r.tipo === tipo)),
    buildMs,
    avgMs: mean(timings),
    maxMs: Math.max(...timings),
  };
}

describe('etiquetas de relevancia', () => {
  const byNumber = new Map(rows.map((r) => [r.registryNumber, r]));

  it('todas apuntan a instituciones del catálogo', () => {
    for (const c of consultas) {
      for (const id of c.relevantes)
        expect(byNumber.has(id), `${c.q}: ${id}`).toBe(true);
      expect(new Set(c.relevantes).size).toBe(c.relevantes.length);
    }
  });

  it('las consultas por nombre coinciden con "el nombre contiene el término"', () => {
    for (const c of consultas.filter((x) =>
      ['nombre', 'navegacional'].includes(x.tipo),
    )) {
      const expected = rows
        .filter((r) => nameKey(r.name).includes(nameKey(c.q)))
        .map((r) => r.registryNumber)
        .sort();
      expect([...c.relevantes].sort(), c.q).toEqual(expected);
    }
  });

  it('la consulta mixta coincide con "instituto profesional" + el término', () => {
    const c = consultas.find((x) => x.tipo === 'mixta')!;
    const expected = rows
      .filter(
        (r) =>
          r.category === 'instituto_profesional' &&
          nameKey(r.name).includes('santiago'),
      )
      .map((r) => r.registryNumber)
      .sort();
    expect([...c.relevantes].sort()).toEqual(expected);
  });

  it('las consultas por tipo coinciden con la categoría y propiedad publicadas', () => {
    const pick = (f: (r: (typeof rows)[number]) => boolean) =>
      rows
        .filter(f)
        .map((r) => r.registryNumber)
        .sort();
    const get = (q: string) =>
      [...consultas.find((c) => c.q === q)!.relevantes].sort();
    expect(get('universidad estatal')).toEqual(
      pick((r) => r.category === 'universidad' && r.ownership === 'estatal'),
    );
    expect(get('universidad particular con aportes')).toEqual(
      pick((r) => r.ownership === 'particular_con_aportes'),
    );
    expect(get('universidad privada')).toEqual(
      pick((r) => r.category === 'universidad' && r.ownership === 'privada'),
    );
    expect(get('instituto profesional')).toEqual(
      pick((r) => r.category === 'instituto_profesional'),
    );
    expect(get('centro de formación técnica')).toEqual(
      pick((r) => r.category === 'centro_formacion_tecnica'),
    );
    expect(get('cft estatal')).toEqual(
      pick(
        (r) =>
          r.category === 'centro_formacion_tecnica' &&
          r.ownership === 'estatal',
      ),
    );
  });
});

describe('calidad de la búsqueda', () => {
  const baseline = evaluate(false);
  const final = evaluate(true);

  it('supera los umbrales mínimos (guarda contra regresiones)', () => {
    // P@K está acotada por min(1, relevantes/K); por eso se exige la versión normalizada (nP@K).
    expect(final.all.np5).toBeGreaterThanOrEqual(0.9);
    expect(final.all.np10).toBeGreaterThanOrEqual(0.9);
    expect(final.all.mrr).toBeGreaterThanOrEqual(0.95);
    expect(final.all.rprec).toBeGreaterThanOrEqual(0.9);
    // Las consultas por nombre, tipo y sigla (lo que el índice sabe resolver) deben ser perfectas.
    for (const t of ['navegacional', 'nombre', 'mixta', 'tipo', 'sigla']) {
      expect(final.byType(t).rprec, t).toBe(1);
    }
    expect(final.byType('navegacional').mrr).toBe(1);
    expect(final.byType('tipo').p10).toBeGreaterThanOrEqual(0.9);
  });

  it('las siglas curadas mejoran las consultas por sigla', () => {
    expect(baseline.byType('sigla').mrr).toBe(0);
    expect(final.byType('sigla').mrr).toBe(1);
    expect(final.all.mrr).toBeGreaterThan(baseline.all.mrr);
  });

  it('las consultas semánticas muestran un límite conocido: el catálogo no trae ubicación', () => {
    const semantic = final.byType('semantica');
    expect(semantic.n).toBe(2);
    expect(semantic.rprec).toBeLessThan(1);
    expect(semantic.mrr).toBe(1); // lo que encuentra, lo pone primero; le faltan las demás
  });

  it('responde en milisegundos', () => {
    expect(final.avgMs).toBeLessThan(25);
  });

  it('escribe el informe si se pide', () => {
    const path = process.env.EVAL_REPORT_PATH;
    if (!path) return;
    writeFileSync(path, renderReport(baseline, final));
  });
});

type Evaluation = ReturnType<typeof evaluate>;

function pct(n: number) {
  return n.toFixed(2);
}

function renderReport(baseline: Evaluation, final: Evaluation): string {
  const line = (label: string, s: Evaluation['all']) =>
    `| ${label} | ${s.n} | ${pct(s.p5)} | ${pct(s.np5)} | ${pct(s.r5)} | ${pct(s.p10)} | ${pct(s.np10)} | ${pct(s.r10)} | ${pct(s.mrr)} | ${pct(s.rprec)} |`;
  const head =
    '| Grupo | Consultas | P@5 | nP@5 | R@5 | P@10 | nP@10 | R@10 | MRR | R-Prec |\n|---|---|---|---|---|---|---|---|---|---|';
  const types = [
    'navegacional',
    'nombre',
    'mixta',
    'tipo',
    'sigla',
    'semantica',
  ];
  const detail = final.results
    .map(
      (r) =>
        `| ${r.q} | ${r.tipo} | ${r.relevantes} | ${pct(r.p5)} | ${pct(r.np5)} | ${pct(r.r5)} | ${pct(r.p10)} | ${pct(r.np10)} | ${pct(r.r10)} | ${pct(r.rr)} | ${pct(r.rprec)} |`,
    )
    .join('\n');
  return [
    '<!-- Generado por backend/test/eval/search-quality.spec.ts. No editar a mano. -->',
    `Corpus: ${rows.length} instituciones del catálogo (edición ${pipeline.sources[0]?.edition ?? '?'}). Consultas: ${consultas.length}.`,
    '',
    `Criterio de relevancia: ${criterio}`,
    '',
    'P@K = relevantes entre los K primeros / K (acotada por min(1, relevantes/K)); nP@K = P@K dividida por ese máximo alcanzable; R@K = relevantes entre los K primeros / total de relevantes; MRR = media de 1/posición del primer relevante; R-Prec = precisión en la posición R (R = número de relevantes).',
    '',
    '### Resultados globales',
    '',
    head,
    line('Sin siglas curadas', baseline.all),
    line('**Con siglas curadas (final)**', final.all),
    '',
    '### Por tipo de consulta (configuración final)',
    '',
    head,
    ...types.map((t) => line(t, final.byType(t))),
    '',
    '### Detalle por consulta (configuración final)',
    '',
    '| Consulta | Tipo | Relevantes | P@5 | nP@5 | R@5 | P@10 | nP@10 | R@10 | RR | R-Prec |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    detail,
    '',
    '### Tiempos',
    '',
    `Construcción del índice: ${final.buildMs.toFixed(1)} ms. ` +
      `Consulta: promedio ${final.avgMs.toFixed(3)} ms, máximo ${final.maxMs.toFixed(3)} ms.`,
    '',
  ].join('\n');
}
