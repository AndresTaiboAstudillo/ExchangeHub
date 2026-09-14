'use client';

import { useState } from 'react';
import ToggleSwitch from './perfil/ToggleSwitch';

export default function PerfilPage({ onToast }) {
  const [langs, setLangs] = useState(['Español', 'Inglés']);
  const [hobbies, setHobbies] = useState(['💻 Programación', '🎮 Gaming', '🎸 Música', '🧗 Deporte']);
  const [langToAdd, setLangToAdd] = useState('Francés');
  const [newHobby, setNewHobby] = useState('');

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-7">
      <h1 className="font-serif text-[26px] mb-1">Mi perfil</h1>
      <p className="text-sm text-muted mb-6">Así te ven otros estudiantes en ExchangeHub</p>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
        {/* Aside */}
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-lg p-7 text-center shadow-card">
            <div className="w-20 h-20 rounded-full bg-forest-mid flex items-center justify-center text-3xl font-bold text-white mx-auto mb-3">
              A
            </div>
            <div className="text-[17px] font-bold mb-1">Agustín Cárdenas</div>
            <div className="text-[13px] text-muted mb-3.5">🇨🇱 Chile — PUCV</div>
            <div className="text-[13px] text-muted">Ingeniería Informática · 4º año</div>
            <div className="grid grid-cols-2 gap-2.5 mt-3.5">
              <Stat value="3" label="Amigos" />
              <Stat value="7" label="Publicaciones" />
            </div>
            <button
              onClick={() => onToast('Foto de perfil actualizada')}
              className="w-full mt-3.5 justify-center px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors"
            >
              📷 Cambiar foto
            </button>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-card">
            <h3 className="text-sm font-bold mb-2.5">Idiomas</h3>
            <div className="flex flex-wrap gap-1.5">
              {langs.map((l) => (
                <span key={l} className="px-2.5 py-1 rounded-full bg-forest-mid text-white text-xs font-semibold">
                  {l}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-card">
            <h3 className="text-sm font-bold mb-2.5">Intereses</h3>
            <div className="flex flex-wrap gap-1.5">
              {hobbies.map((h) => (
                <span key={h} className="px-2.5 py-1 rounded-full bg-surface-2 text-ink-mid text-xs font-medium">
                  {h}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Main */}
        <div>
          <div className="bg-white rounded-lg p-6 shadow-card mb-5">
            <h3 className="text-base font-bold mb-4 pb-2.5 border-b-[1.5px] border-border">Información personal</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <Field label="Nombre" defaultValue="Agustín" />
              <Field label="Apellido" defaultValue="Cárdenas" />
              <Field label="Correo electrónico" type="email" defaultValue="agustin.cardenas@pucv.cl" />
              <Field label="País de origen" defaultValue="Chile" />
              <Field label="Universidad de intercambio (si aplica)" placeholder="Ej: Universidad de Barcelona" />
              <Field label="Carrera" defaultValue="Ingeniería Informática" />
            </div>
            <div className="mt-3.5">
              <label className="text-[13px] font-semibold text-ink-mid block mb-1.5">Bio breve</label>
              <textarea
                className="w-full px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm min-h-[90px] resize-y focus:outline-none focus:border-forest-lt focus:ring-[3px] focus:ring-forest-lt/15"
                defaultValue="Estudiante de ingeniería en Valparaíso. Me gusta el deporte y la música. Siempre dispuesto a conocer gente nueva y explorar la ciudad."
              />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-card mb-5">
            <h3 className="text-base font-bold mb-4 pb-2.5 border-b-[1.5px] border-border">Idiomas que hablas</h3>
            <div className="flex gap-2 flex-wrap mb-3">
              {langs.map((l) => (
                <span
                  key={l}
                  onClick={() => setLangs((arr) => arr.filter((x) => x !== l))}
                  className="cursor-pointer px-2.5 py-1 rounded-full bg-forest-mid text-white text-xs font-semibold"
                >
                  {l} ✕
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <select
                value={langToAdd}
                onChange={(e) => setLangToAdd(e.target.value)}
                className="max-w-[200px] px-3.5 py-2 border-[1.5px] border-border rounded-lg text-sm bg-white"
              >
                {['Francés', 'Portugués', 'Alemán', 'Italiano', 'Japonés', 'Árabe'].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (!langs.includes(langToAdd)) setLangs((arr) => [...arr, langToAdd]);
                  onToast('Idioma agregado');
                }}
                className="px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors"
              >
                + Agregar
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-card mb-5">
            <h3 className="text-base font-bold mb-4 pb-2.5 border-b-[1.5px] border-border">Intereses y hobbies</h3>
            <div className="flex gap-2 flex-wrap mb-3">
              {hobbies.map((h) => (
                <span
                  key={h}
                  onClick={() => setHobbies((arr) => arr.filter((x) => x !== h))}
                  className="cursor-pointer px-2.5 py-1 rounded-full bg-surface-2 text-ink-mid text-xs font-medium"
                >
                  {h} ✕
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newHobby}
                onChange={(e) => setNewHobby(e.target.value)}
                placeholder="Agrega un interés…"
                className="max-w-[220px] px-3.5 py-2 border-[1.5px] border-border rounded-lg text-sm"
              />
              <button
                onClick={() => {
                  if (newHobby.trim()) setHobbies((arr) => [...arr, newHobby.trim()]);
                  setNewHobby('');
                  onToast('Interés agregado');
                }}
                className="px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors"
              >
                + Agregar
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-card mb-5">
            <h3 className="text-base font-bold mb-4 pb-2.5 border-b-[1.5px] border-border">Privacidad</h3>
            <div className="flex flex-col gap-3.5">
              <PrivacyRow
                title="Perfil visible para otros estudiantes"
                desc='Otros usuarios pueden encontrarte en "Encontrar amigos"'
              />
              <PrivacyRow
                title="Recibir solicitudes de amistad"
                desc="Permite que otros estudiantes te envíen solicitudes"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5">
            <button
              onClick={() => onToast('Cambios descartados')}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => onToast('Perfil guardado correctamente ✓')}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-amber text-forest hover:bg-amber-lt transition-colors"
            >
              Guardar cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="bg-surface rounded-lg p-2.5 text-center">
      <strong className="block text-xl text-forest-mid">{value}</strong>
      <span className="text-[11px] text-muted">{label}</span>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-semibold text-ink-mid">{label}</label>
      <input
        {...props}
        className="px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm focus:outline-none focus:border-forest-lt focus:ring-[3px] focus:ring-forest-lt/15"
      />
    </div>
  );
}

function PrivacyRow({ title, desc }) {
  return (
    <div className="flex justify-between items-center">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted">{desc}</div>
      </div>
      <ToggleSwitch defaultChecked />
    </div>
  );
}
