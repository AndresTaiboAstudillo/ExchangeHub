// Cliente de la API de ExchangeHub (NestJS). Todas las pantallas hablan con el backend por aquí.

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const TOKEN_KEY = 'exchangehub_token';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// El token vive en localStorage (con respaldo en memoria si no está disponible, p. ej. en el servidor).
let memoryToken = null;

export const tokenStore = {
  get() {
    try {
      return window.localStorage.getItem(TOKEN_KEY) ?? memoryToken;
    } catch {
      return memoryToken;
    }
  },
  set(token) {
    memoryToken = token;
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* sin almacenamiento persistente: queda en memoria */
    }
  },
  clear() {
    memoryToken = null;
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* nada que limpiar */
    }
  },
};

let unauthorizedHandler = null;

/** Se llama cuando el servidor rechaza el token (sesión vencida o inválida). */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

function messageFor(status, body) {
  const message = body && body.message;
  // Los mensajes de los servicios vienen en español; los de validación (lista) no.
  if (typeof message === 'string') return message;
  if (status === 400) return 'Revisa los datos ingresados.';
  if (status === 401) return 'Tu sesión no es válida. Inicia sesión de nuevo.';
  if (status === 403) return 'No tienes permiso para hacer esto.';
  if (status === 404) return 'No se encontró lo que buscabas.';
  if (status === 409) return 'Esta acción entra en conflicto con el estado actual.';
  if (status >= 500) return 'El servidor tuvo un problema. Inténtalo de nuevo en unos minutos.';
  return 'No se pudo completar la acción.';
}

export async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = tokenStore.get();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. Revisa tu conexión.');
  }

  if (response.status === 204) return null;

  let data = null;
  try {
    data = await response.json();
  } catch {
    /* respuesta sin cuerpo JSON */
  }

  if (!response.ok) {
    if (response.status === 401 && auth) {
      tokenStore.clear();
      if (unauthorizedHandler) unauthorizedHandler();
    }
    throw new ApiError(response.status, messageFor(response.status, data));
  }
  return data;
}

function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const api = {
  // Autenticación
  register: (data) => request('/auth/register', { method: 'POST', body: data, auth: false }),
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password }, auth: false }),

  // Perfil y estudiantes
  me: () => request('/users/me'),
  updateMe: (data) => request('/users/me', { method: 'PATCH', body: data }),
  users: () => request('/users'),

  // Comunidad
  posts: ({ category, cursor, limit } = {}) =>
    request(`/posts${query({ category, cursor, limit })}`),
  post: (id) => request(`/posts/${id}`),
  createPost: (data) => request('/posts', { method: 'POST', body: data }),
  deletePost: (id) => request(`/posts/${id}`, { method: 'DELETE' }),
  createReply: (postId, body) =>
    request(`/posts/${postId}/replies`, { method: 'POST', body: { body } }),
  deleteReply: (postId, replyId) =>
    request(`/posts/${postId}/replies/${replyId}`, { method: 'DELETE' }),
  like: (postId) => request(`/posts/${postId}/like`, { method: 'PUT' }),
  unlike: (postId) => request(`/posts/${postId}/like`, { method: 'DELETE' }),

  // Universidades (catálogo oficial enriquecido, con procedencia de cada dato)
  universities: ({ q, category, ownership, limit, offset } = {}) =>
    request(`/universities${query({ q, category, ownership, limit, offset })}`),
  universitiesSources: () => request('/universities/sources'),

  // Amistades
  friendships: (status) => request(`/friendships${query({ status })}`),
  requestFriendship: (addresseeId) =>
    request('/friendships', { method: 'POST', body: { addresseeId } }),
  respondFriendship: (id, status) =>
    request(`/friendships/${id}`, { method: 'PATCH', body: { status } }),
  removeFriendship: (id) => request(`/friendships/${id}`, { method: 'DELETE' }),
};
