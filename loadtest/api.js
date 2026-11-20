// Prueba de carga de la API REST de ExchangeHub (k6).
//
// Requisito que verifica: «la API REST responde en menos de 500 ms en el percentil 95 bajo carga normal
// (hasta 100 usuarios concurrentes)». Cada usuario virtual se comporta como una persona: inicia sesión UNA vez,
// y luego navega con pausas de 1 a 3 segundos entre acciones (mapa, universidades, comunidad, perfil, chat…),
// con algunas escrituras (publicar, responder, dar «me gusta», reseñar).
//
// Uso (ver docs/pruebas-de-carga.md):
//   k6 run loadtest/api.js                                  # carga normal: 100 usuarios sostenidos
//   k6 run -e PERFIL=estres loadtest/api.js                 # escalera hasta 400 usuarios, para ver dónde se rompe
//   k6 run -e VUS=50 -e SOSTENER=2m -e BASE_URL=http://localhost:8000 loadtest/api.js
//   k6 run --summary-export=loadtest/resultados/resumen.json loadtest/api.js
//
// Variables: BASE_URL (http://localhost:8000), PERFIL (normal|estres|humo), VUS (100), SUBIDA (1m), SOSTENER (5m),
//            USUARIOS (300, los que crea seed.sql), CLAVE (carga-prueba-123).

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE = (__ENV.BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const PERFIL = __ENV.PERFIL || 'normal';
const VUS = Number(__ENV.VUS || 100);
const USUARIOS = Number(__ENV.USUARIOS || 300);
const CLAVE = __ENV.CLAVE || 'carga-prueba-123';

const escenarios = {
  // Carga normal: sube a VUS usuarios, los mantiene y baja. Es la que se compara con el requisito.
  normal: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: __ENV.SUBIDA || '1m', target: VUS },
      { duration: __ENV.SOSTENER || '5m', target: VUS },
      { duration: '30s', target: 0 },
    ],
    gracefulRampDown: '30s',
  },
  // Estrés: escalones de 50 a 400 usuarios para encontrar el punto donde el p95 supera los 500 ms.
  estres: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 50 },
      { duration: '2m', target: 100 },
      { duration: '2m', target: 200 },
      { duration: '2m', target: 300 },
      { duration: '2m', target: 400 },
      { duration: '1m', target: 0 },
    ],
    gracefulRampDown: '30s',
  },
  // Humo: comprueba en 30 s que el script y los datos funcionan antes de lanzar la prueba larga.
  humo: { executor: 'constant-vus', vus: 5, duration: '30s' },
};

// Endpoints medidos: cada uno con su propio umbral de p95 < 500 ms (además del global).
const LECTURAS = [
  'GET /map/listings',
  'GET /map/zones',
  'GET /map/places',
  'GET /map/universities',
  'GET /universities',
  'GET /posts',
  'GET /posts/:id',
  'GET /users',
  'GET /users/me',
  'GET /notifications',
  'GET /chat/conversations',
  'GET /friendships',
  'GET /map/listings/:id/reviews',
];
const ESCRITURAS = [
  'POST /posts',
  'POST /posts/:id/replies',
  'PUT /posts/:id/like',
  'PUT /map/listings/:id/reviews',
];

const umbrales = {
  // Requisito principal: toda la API (sin el inicio de sesión) con p95 < 500 ms.
  'http_req_duration{kind:api}': ['p(95)<500'],
  // Menos de 1 % de errores (cualquier respuesta distinta de 2xx cuenta como error).
  'http_req_failed{kind:api}': ['rate<0.01'],
  // El inicio de sesión usa bcrypt (lento a propósito): se mide aparte, con un margen mayor.
  'http_req_duration{kind:login}': ['p(95)<2000'],
};
for (const nombre of [...LECTURAS, ...ESCRITURAS]) {
  umbrales[`http_req_duration{name:${nombre}}`] = ['p(95)<500'];
}

export const options = {
  scenarios: { [PERFIL]: escenarios[PERFIL] || escenarios.normal },
  thresholds: umbrales,
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'max'],
};

const iteracionesCompletas = new Counter('iteraciones_completas');

// Estado de cada usuario virtual (en k6 cada VU tiene su propia copia del módulo).
const estado = { token: null, me: null, listings: [], posts: [] };

const pick = (lista) => lista[Math.floor(Math.random() * lista.length)];
const pausa = () => sleep(1 + Math.random() * 2); // 1 a 3 s, como una persona

function cabeceras() {
  return { headers: { Authorization: `Bearer ${estado.token}`, 'Content-Type': 'application/json' } };
}

function pedir(metodo, ruta, nombre, cuerpo) {
  const params = { ...cabeceras(), tags: { name: nombre, kind: 'api' } };
  const res = cuerpo === undefined
    ? http.request(metodo, `${BASE}${ruta}`, null, params)
    : http.request(metodo, `${BASE}${ruta}`, JSON.stringify(cuerpo), params);
  check(res, { [`${nombre} → 2xx`]: (r) => r.status >= 200 && r.status < 300 }, { name: nombre });
  return res;
}

const json = (res) => {
  try {
    return res.json();
  } catch (_) {
    return null;
  }
};

function iniciarSesion() {
  const n = ((__VU - 1) % USUARIOS) + 1;
  const res = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ email: `carga-${n}@carga.test`, password: CLAVE }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'POST /auth/login', kind: 'login' } },
  );
  const ok = check(res, { 'login → 200': (r) => r.status === 200 }, { name: 'POST /auth/login' });
  if (!ok) return false;
  estado.token = res.json('accessToken');
  return true;
}

// ── Acciones (cada una es una pantalla o gesto de la app) ───────────────────────────────────────────────

function verMapa() {
  const listings = json(pedir('GET', '/map/listings', 'GET /map/listings'));
  if (Array.isArray(listings) && listings.length) estado.listings = listings.map((l) => l.id);
  pedir('GET', '/map/zones', 'GET /map/zones');
  pedir('GET', '/map/universities', 'GET /map/universities');
  pedir('GET', '/map/places?bbox=-71.66,-33.06,-71.58,-33.02&limit=300', 'GET /map/places');
}

function verResenas() {
  if (!estado.listings.length) return;
  pedir('GET', `/map/listings/${pick(estado.listings)}/reviews`, 'GET /map/listings/:id/reviews');
}

function buscarUniversidades() {
  const consulta = pick(['', 'universidad', 'carga', 'valparaiso', 'estatal']);
  pedir('GET', `/universities?limit=20${consulta ? `&q=${consulta}` : ''}`, 'GET /universities');
}

function verComunidad() {
  const pagina = json(pedir('GET', '/posts?limit=20', 'GET /posts'));
  if (pagina && Array.isArray(pagina.items) && pagina.items.length) {
    estado.posts = pagina.items.map((p) => p.id);
    pedir('GET', `/posts/${pick(estado.posts)}`, 'GET /posts/:id');
  }
}

function verPersonasYChat() {
  pedir('GET', '/users', 'GET /users');
  pedir('GET', '/friendships', 'GET /friendships');
  pedir('GET', '/chat/conversations', 'GET /chat/conversations');
}

function verPerfilYAvisos() {
  pedir('GET', '/users/me', 'GET /users/me');
  pedir('GET', '/notifications', 'GET /notifications');
}

function publicar() {
  pedir('POST', '/posts', 'POST /posts', {
    category: pick(['arriendo', 'hangout', 'evento', 'info']),
    title: `Publicación de carga ${__VU}-${__ITER}`,
    body: 'Texto de una publicación creada durante la prueba de carga.',
  });
}

function responder() {
  if (!estado.posts.length) return;
  pedir('POST', `/posts/${pick(estado.posts)}/replies`, 'POST /posts/:id/replies', {
    body: 'Respuesta creada durante la prueba de carga.',
  });
}

function darMeGusta() {
  if (!estado.posts.length) return;
  pedir('PUT', `/posts/${pick(estado.posts)}/like`, 'PUT /posts/:id/like');
}

function resenar() {
  if (!estado.listings.length) return;
  pedir('PUT', `/map/listings/${pick(estado.listings)}/reviews`, 'PUT /map/listings/:id/reviews', {
    rating: 1 + Math.floor(Math.random() * 5),
    body: 'Reseña creada durante la prueba de carga.',
  });
}

// Mezcla de uso: sobre todo lectura (como en la realidad), con pocas escrituras.
const MEZCLA = [
  [25, verMapa],
  [10, verResenas],
  [15, buscarUniversidades],
  [20, verComunidad],
  [10, verPersonasYChat],
  [8, verPerfilYAvisos],
  [4, publicar],
  [3, responder],
  [3, darMeGusta],
  [2, resenar],
];
const TOTAL = MEZCLA.reduce((s, [peso]) => s + peso, 0);

function elegirAccion() {
  let x = Math.random() * TOTAL;
  for (const [peso, accion] of MEZCLA) {
    x -= peso;
    if (x < 0) return accion;
  }
  return MEZCLA[0][1];
}

export function setup() {
  // Falla rápido, con un mensaje claro, si la API no responde o los datos de prueba no están cargados.
  const salud = http.get(`${BASE}/health`);
  if (salud.status !== 200) throw new Error(`La API no responde en ${BASE}/health (estado ${salud.status}).`);
  const login = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ email: 'carga-1@carga.test', password: CLAVE }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (login.status === 429) throw new Error('La API limita los intentos (429): inicia el backend con RATE_LIMIT_DISABLED=true.');
  if (login.status !== 200) throw new Error('No se pudo iniciar sesión con carga-1@carga.test: ¿se cargó loadtest/seed.sql?');
}

export default function () {
  if (!estado.token && !iniciarSesion()) {
    sleep(5);
    return;
  }
  elegirAccion()();
  iteracionesCompletas.add(1);
  pausa();
}
