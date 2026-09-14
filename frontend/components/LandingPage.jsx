'use client';

import { useState } from 'react';

const FEATURES = [
  { icon: '🏠', title: 'Arriendos y comercios verificados', text: 'Reseñas de estudiantes, no de agencias' },
  { icon: '🗺', title: 'Mapa interactivo de la ciudad', text: 'Zonas seguras, tiendas y transporte' },
  { icon: '👫', title: 'Encuentra amigos antes de llegar', text: 'Conecta con otros intercambios y estudiantes locales' },
];

export default function LandingPage({ onLogin }) {
  const [mode, setMode] = useState('login');

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

          <div className="flex bg-surface-2 rounded-xl p-1 gap-1 mb-2">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                mode === 'login' ? 'bg-white text-forest shadow-sm' : 'text-muted'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                mode === 'register' ? 'bg-white text-forest shadow-sm' : 'text-muted'
              }`}
            >
              Registrarse
            </button>
          </div>

          {mode === 'login' ? (
            <div className="flex flex-col gap-4">
              <Field label="Correo electrónico" type="email" placeholder="tu@correo.com" />
              <Field label="Contraseña" type="password" placeholder="••••••••" />
              <button
                onClick={onLogin}
                className="w-full flex justify-center items-center gap-1.5 py-2.5 px-5 rounded-lg text-sm font-semibold bg-forest-mid text-white hover:bg-forest-lt transition-colors active:scale-[.97]"
              >
                Iniciar sesión
              </button>
              <Divider />
              <button
                onClick={onLogin}
                className="w-full flex justify-center items-center gap-1.5 py-2.5 px-5 rounded-lg text-sm font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors active:scale-[.97]"
              >
                🌐 &nbsp;Cuenta universitaria PUCV
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Field label="Nombre completo" type="text" placeholder="María González" />
              <Field label="Correo electrónico" type="email" placeholder="tu@correo.com" />
              <Field label="Universidad de origen" type="text" placeholder="Ej: Universidad de Barcelona" />
              <Field label="Contraseña" type="password" placeholder="Mínimo 8 caracteres" />
              <button
                onClick={onLogin}
                className="w-full flex justify-center items-center gap-1.5 py-2.5 px-5 rounded-lg text-sm font-semibold bg-amber text-forest hover:bg-amber-lt hover:shadow-[0_2px_10px_rgba(212,160,23,.35)] transition-colors active:scale-[.97]"
              >
                Crear cuenta
              </button>
            </div>
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
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-semibold text-ink-mid">{label}</label>
      <input
        {...props}
        className="px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm bg-white text-ink focus:outline-none focus:border-forest-lt focus:ring-[3px] focus:ring-forest-lt/15 transition-colors"
      />
    </div>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-muted text-xs my-1 before:content-[''] before:flex-1 before:h-px before:bg-border after:content-[''] after:flex-1 after:h-px after:bg-border">
      o continúa con
    </div>
  );
}
