'use client';

import { useId, useState } from 'react';

const FEATURES = [
  { icon: '🏠', title: 'Arriendos y comercios verificados', text: 'Reseñas de estudiantes, no de agencias' },
  { icon: '🗺', title: 'Mapa interactivo de la ciudad', text: 'Zonas seguras, tiendas y transporte' },
  { icon: '👫', title: 'Encuentra amigos antes de llegar', text: 'Conecta con otros intercambios y estudiantes locales' },
];

const MIN_PASSWORD = 8;

export default function LandingPage({ onLogin, onRegister }) {
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [login, setLogin] = useState({ email: '', password: '' });
  const [signup, setSignup] = useState({ name: '', email: '', universityOrigin: '', password: '' });

  const switchMode = (next) => {
    setMode(next);
    setError('');
  };

  // Ejecuta la acción mostrando el error del servidor (en español) si falla.
  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message || 'No se pudo completar la acción.');
    } finally {
      setBusy(false);
    }
  };

  const submitLogin = (e) => {
    e.preventDefault();
    run(() => onLogin(login.email.trim(), login.password));
  };

  const submitRegister = (e) => {
    e.preventDefault();
    if (signup.password.length < MIN_PASSWORD) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    run(() =>
      onRegister({
        name: signup.name.trim(),
        email: signup.email.trim(),
        universityOrigin: signup.universityOrigin.trim(),
        password: signup.password,
      }),
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 min-h-screen">
      {/* Left panel */}
      <div className="relative overflow-hidden bg-forest flex flex-col justify-center px-8 md:px-14 py-14">
        <div className="absolute -bottom-20 -right-20 w-[340px] h-[340px] rounded-full bg-forest-lt/20" />
        <div className="absolute -top-16 -left-16 w-[220px] h-[220px] rounded-full bg-amber/10" />

        <div className="relative z-10">
          <div className="font-serif text-4xl text-white mb-2.5">
            Exchange<span className="text-amber-lt">Hub</span>
          </div>
          <p className="text-base text-white/70 leading-relaxed max-w-md mb-10">
            La plataforma para estudiantes internacionales en Chile. Alojamiento,
            comunidad e información universitaria — todo en un solo lugar.
          </p>

          <div className="flex flex-col gap-[18px]">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-lg flex-shrink-0 bg-white/10 flex items-center justify-center text-lg">
                  {f.icon}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white mb-0.5">{f.title}</h4>
                  <p className="text-[13px] text-white/60">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — auth */}
      <div className="flex items-center justify-center bg-surface px-6 md:px-12 py-14">
        <div className="w-full max-w-[380px]">
          <h2 className="font-serif text-[28px] mb-1.5 text-ink">Bienvenido/a</h2>
          <p className="text-sm text-muted mb-7">Accede a tu cuenta o regístrate para comenzar</p>

          <div role="tablist" className="flex bg-surface-2 rounded-xl p-1 gap-1 mb-2">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                mode === 'login' ? 'bg-white text-forest shadow-sm' : 'text-muted'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => switchMode('register')}
              className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                mode === 'register' ? 'bg-white text-forest shadow-sm' : 'text-muted'
              }`}
            >
              Registrarse
            </button>
          </div>

          {mode === 'login' ? (
            <form onSubmit={submitLogin} className="flex flex-col gap-4">
              <Field
                label="Correo electrónico"
                type="email"
                name="email"
                autoComplete="email"
                required
                placeholder="tu@correo.com"
                value={login.email}
                onChange={(e) => setLogin((v) => ({ ...v, email: e.target.value }))}
              />
              <Field
                label="Contraseña"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={login.password}
                onChange={(e) => setLogin((v) => ({ ...v, password: e.target.value }))}
              />
              <ErrorMessage text={error} />
              <button
                type="submit"
                disabled={busy}
                className="w-full flex justify-center items-center gap-1.5 py-2.5 px-5 rounded-lg text-sm font-semibold bg-forest-mid text-white hover:bg-forest-lt transition-colors active:scale-[.97] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy ? 'Iniciando sesión…' : 'Iniciar sesión'}
              </button>
              <Divider />
              <button
                type="button"
                disabled
                title="Próximamente"
                className="w-full flex justify-center items-center gap-1.5 py-2.5 px-5 rounded-lg text-sm font-semibold border-[1.5px] border-border text-ink-mid opacity-60 cursor-not-allowed"
              >
                🌐 &nbsp;Cuenta universitaria PUCV
              </button>
            </form>
          ) : (
            <form onSubmit={submitRegister} className="flex flex-col gap-4">
              <Field
                label="Nombre completo"
                type="text"
                name="name"
                autoComplete="name"
                required
                maxLength={100}
                placeholder="María González"
                value={signup.name}
                onChange={(e) => setSignup((v) => ({ ...v, name: e.target.value }))}
              />
              <Field
                label="Correo electrónico"
                type="email"
                name="email"
                autoComplete="email"
                required
                placeholder="tu@correo.com"
                value={signup.email}
                onChange={(e) => setSignup((v) => ({ ...v, email: e.target.value }))}
              />
              <Field
                label="Universidad de origen"
                type="text"
                name="universityOrigin"
                maxLength={150}
                placeholder="Ej: Universidad de Barcelona"
                value={signup.universityOrigin}
                onChange={(e) => setSignup((v) => ({ ...v, universityOrigin: e.target.value }))}
              />
              <Field
                label="Contraseña"
                type="password"
                name="password"
                autoComplete="new-password"
                required
                maxLength={72}
                placeholder="Mínimo 8 caracteres"
                value={signup.password}
                onChange={(e) => setSignup((v) => ({ ...v, password: e.target.value }))}
              />
              <ErrorMessage text={error} />
              <button
                type="submit"
                disabled={busy}
                className="w-full flex justify-center items-center gap-1.5 py-2.5 px-5 rounded-lg text-sm font-semibold bg-amber text-forest hover:bg-amber-lt hover:shadow-[0_2px_10px_rgba(212,160,23,.35)] transition-colors active:scale-[.97] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy ? 'Creando cuenta…' : 'Crear cuenta'}
              </button>
            </form>
          )}

          <p className="text-xs text-muted mt-4 text-center">
            Al acceder aceptas nuestros <u>Términos de uso</u> y <u>Política de privacidad</u>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, ...props }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink-mid">
        {label}
      </label>
      <input
        id={id}
        {...props}
        className="px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm bg-white text-ink focus:outline-none focus:border-forest-lt focus:ring-[3px] focus:ring-forest-lt/15 transition-colors"
      />
    </div>
  );
}

function ErrorMessage({ text }) {
  if (!text) return null;
  return (
    <p role="alert" className="text-[13px] text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
      {text}
    </p>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-muted text-xs my-1 before:content-[''] before:flex-1 before:h-px before:bg-border after:content-[''] after:flex-1 after:h-px after:bg-border">
      o continúa con
    </div>
  );
}
