import { api, ApiError, request, setUnauthorizedHandler, tokenStore } from './api';

function respond(status, body) {
  return Promise.resolve(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

let fetchMock;

beforeEach(() => {
  tokenStore.clear();
  setUnauthorizedHandler(null);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1);
  return { url, init };
};

describe('request', () => {
  it('envía el token en Authorization', async () => {
    tokenStore.set('abc123');
    fetchMock.mockReturnValue(respond(200, { ok: true }));
    await request('/users/me');
    expect(lastCall().init.headers.Authorization).toBe('Bearer abc123');
  });

  it('no envía el token en login ni registro', async () => {
    tokenStore.set('abc123');
    fetchMock.mockReturnValue(respond(200, { accessToken: 'x' }));
    await api.login('a@b.cl', 'clave-segura-123');
    const { url, init } = lastCall();
    expect(url).toMatch(/\/auth\/login$/);
    expect(init.headers.Authorization).toBeUndefined();
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.cl', password: 'clave-segura-123' });
  });

  it('devuelve null en respuestas 204', async () => {
    fetchMock.mockReturnValue(respond(204));
    await expect(api.deletePost('p1')).resolves.toBeNull();
  });

  it('usa el mensaje en español que manda el servidor', async () => {
    fetchMock.mockReturnValue(respond(409, { message: 'El email ya está registrado' }));
    const error = await api.register({}).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.message).toBe('El email ya está registrado');
  });

  it('traduce los errores de validación (lista de mensajes) a un texto genérico', async () => {
    fetchMock.mockReturnValue(respond(400, { message: ['email must be an email'], error: 'Bad Request' }));
    const error = await api.register({}).catch((e) => e);
    expect(error.message).toBe('Revisa los datos ingresados.');
  });

  it('avisa si no hay conexión', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const error = await api.me().catch((e) => e);
    expect(error.status).toBe(0);
    expect(error.message).toMatch(/No se pudo conectar/);
  });

  it('ante un 401 autenticado limpia el token y avisa', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    tokenStore.set('vencido');
    fetchMock.mockReturnValue(respond(401, { message: 'Token inválido o expirado' }));
    await api.me().catch(() => {});
    expect(tokenStore.get()).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('un 401 en el login (credenciales incorrectas) no cierra ninguna sesión', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    fetchMock.mockReturnValue(respond(401, { message: 'Credenciales inválidas' }));
    const error = await api.login('a@b.cl', 'mala').catch((e) => e);
    expect(error.message).toBe('Credenciales inválidas');
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('api', () => {
  beforeEach(() => fetchMock.mockImplementation(() => respond(200, {})));

  it('arma la URL de las publicaciones omitiendo parámetros vacíos', async () => {
    await api.posts({ category: 'info', cursor: 'abc', limit: undefined });
    expect(lastCall().url).toMatch(/\/posts\?category=info&cursor=abc$/);
    await api.posts({});
    expect(lastCall().url).toMatch(/\/posts$/);
  });

  it('usa el método correcto en cada acción', async () => {
    await api.like('p1');
    expect(lastCall().init.method).toBe('PUT');
    await api.unlike('p1');
    expect(lastCall().init.method).toBe('DELETE');
    await api.updateMe({ bio: null });
    expect(lastCall().init.method).toBe('PATCH');
    await api.respondFriendship('f1', 'accepted');
    expect(lastCall().init.method).toBe('PATCH');
    expect(JSON.parse(lastCall().init.body)).toEqual({ status: 'accepted' });
    await api.createReply('p1', 'Hola');
    expect(JSON.parse(lastCall().init.body)).toEqual({ body: 'Hola' });
  });
});
