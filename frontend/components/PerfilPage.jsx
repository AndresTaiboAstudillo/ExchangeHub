'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../app/providers';
import { api } from '../lib/api';
import { emptyToNull, initialOf, joinName, splitName } from '../lib/format';
import { LANGUAGES, languageLabel } from '../lib/languages';
import ToggleSwitch from './perfil/ToggleSwitch';

const MAX_HOBBIES = 20;

// El perfil guarda un solo nombre; el formulario lo muestra como Nombre y Apellido.
function toForm(user) {
  const { firstName, lastName } = splitName(user.name);
  return {
    firstName,
    lastName,
    countryOfOrigin: user.countryOfOrigin ?? '',
    universityOrigin: user.universityOrigin ?? '',
    career: user.career ?? '',
    bio: user.bio ?? '',
    isVisible: user.isVisible,
    languages: user.languages,
    hobbies: user.hobbies,
  };
}

export default function PerfilPage({ onToast }) {
  const { user, setUser, logout } = useApp();
  const router = useRouter();
  const [form, setForm] = useState(() => toForm(user));
  const [saving, setSaving] = useState(false);
  const [langToAdd, setLangToAdd] = useState('');
  const [newHobby, setNewHobby] = useState('');

  const field = (name) => ({
    value: form[name],
    onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })),
  });

  const availableLanguages = LANGUAGES.filter((l) => !form.languages.includes(l.code));
  const languageChoice = availableLanguages.some((l) => l.code === langToAdd)
    ? langToAdd
    : (availableLanguages[0]?.code ?? '');

  const addLanguage = () => {
    if (!languageChoice) return;
    setForm((f) => ({ ...f, languages: [...f.languages, languageChoice] }));
  };

  const addHobby = () => {
    const hobby = newHobby.trim();
    if (!hobby) return;
    const exists = form.hobbies.some((h) => h.toLowerCase() === hobby.toLowerCase());
    if (exists) {
      onToast('Ese interés ya está en tu lista');
    } else if (form.hobbies.length >= MAX_HOBBIES) {
      onToast(`Puedes agregar hasta ${MAX_HOBBIES} intereses`);
    } else {
      setForm((f) => ({ ...f, hobbies: [...f.hobbies, hobby] }));
    }
    setNewHobby('');
  };

  const save = async () => {
    const name = joinName(form.firstName, form.lastName);
    if (!name) {
      onToast('Escribe tu nombre');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateMe({
        name,
        countryOfOrigin: emptyToNull(form.countryOfOrigin),
        universityOrigin: emptyToNull(form.universityOrigin),
        career: emptyToNull(form.career),
        bio: emptyToNull(form.bio),
        isVisible: form.isVisible,
        languageCodes: form.languages,
        hobbies: form.hobbies,
      });
      setUser(updated);
      setForm(toForm(updated));
      onToast('Perfil guardado correctamente ✓');
    } catch (err) {
      onToast(err.message);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setForm(toForm(user));
    onToast('Cambios descartados');
  };

  const signOut = () => {
    logout();
    router.replace('/login');
  };

  const place = [user.countryOfOrigin, user.universityOrigin].filter(Boolean).join(' — ');

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-7">
      <div className="flex justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="font-serif text-[26px] mb-1">Mi perfil</h1>
          <p className="text-sm text-muted">Así te ven otros estudiantes en ExchangeHub</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors flex-shrink-0"
        >
          Cerrar sesión
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
        {/* Aside */}
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-lg p-7 text-center shadow-card">
            <div className="w-20 h-20 rounded-full bg-forest-mid flex items-center justify-center text-3xl font-bold text-white mx-auto mb-3">
              {initialOf(user.name)}
            </div>
            <div className="text-[17px] font-bold mb-1">{user.name}</div>
            {place && <div className="text-[13px] text-muted mb-3.5">🌎 {place}</div>}
            {user.career && <div className="text-[13px] text-muted">{user.career}</div>}
            <div className="grid grid-cols-2 gap-2.5 mt-3.5">
              <Stat value={user.friendsCount} label="Amigos" />
              <Stat value={user.postsCount} label="Publicaciones" />
            </div>
            <button
              type="button"
              disabled
              title="Próximamente"
              className="w-full mt-3.5 justify-center px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border-[1.5px] border-border text-ink-mid opacity-60 cursor-not-allowed"
            >
              📷 Cambiar foto
            </button>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-card">
            <h3 className="text-sm font-bold mb-2.5">Idiomas</h3>
            {user.languages.length === 0 ? (
              <p className="text-xs text-muted">Aún no agregaste idiomas.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {user.languages.map((code) => (
                  <span key={code} className="px-2.5 py-1 rounded-full bg-forest-mid text-white text-xs font-semibold">
                    {languageLabel(code)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg p-6 shadow-card">
            <h3 className="text-sm font-bold mb-2.5">Intereses</h3>
            {user.hobbies.length === 0 ? (
              <p className="text-xs text-muted">Aún no agregaste intereses.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {user.hobbies.map((h) => (
                  <span key={h} className="px-2.5 py-1 rounded-full bg-surface-2 text-ink-mid text-xs font-medium">
                    {h}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main */}
        <div>
          <div className="bg-white rounded-lg p-6 shadow-card mb-5">
            <h3 className="text-base font-bold mb-4 pb-2.5 border-b-[1.5px] border-border">Información personal</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <Field label="Nombre" maxLength={60} {...field('firstName')} />
              <Field label="Apellido" maxLength={60} {...field('lastName')} />
              <Field label="Correo electrónico" type="email" value={user.email} readOnly hint="El correo no se puede cambiar." />
              <Field label="País de origen" maxLength={100} {...field('countryOfOrigin')} />
              <Field
                label="Universidad de origen"
                maxLength={150}
                placeholder="Ej: Universidad de Barcelona"
                {...field('universityOrigin')}
              />
              <Field label="Carrera" maxLength={100} {...field('career')} />
            </div>
            <div className="mt-3.5">
              <BioField {...field('bio')} />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-card mb-5">
            <h3 className="text-base font-bold mb-4 pb-2.5 border-b-[1.5px] border-border">Idiomas que hablas</h3>
            <div className="flex gap-2 flex-wrap mb-3">
              {form.languages.map((code) => (
                <button
                  type="button"
                  key={code}
                  aria-label={`Quitar ${languageLabel(code)}`}
                  onClick={() => setForm((f) => ({ ...f, languages: f.languages.filter((c) => c !== code) }))}
                  className="px-2.5 py-1 rounded-full bg-forest-mid text-white text-xs font-semibold hover:bg-forest-lt transition-colors"
                >
                  {languageLabel(code)} ✕
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <select
                aria-label="Idioma a agregar"
                value={languageChoice}
                onChange={(e) => setLangToAdd(e.target.value)}
                disabled={availableLanguages.length === 0}
                className="max-w-[200px] px-3.5 py-2 border-[1.5px] border-border rounded-lg text-sm bg-white"
              >
                {availableLanguages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addLanguage}
                disabled={!languageChoice}
                className="px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors disabled:opacity-50"
              >
                + Agregar
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-card mb-5">
            <h3 className="text-base font-bold mb-4 pb-2.5 border-b-[1.5px] border-border">Intereses y hobbies</h3>
            <div className="flex gap-2 flex-wrap mb-3">
              {form.hobbies.map((h) => (
                <button
                  type="button"
                  key={h}
                  aria-label={`Quitar ${h}`}
                  onClick={() => setForm((f) => ({ ...f, hobbies: f.hobbies.filter((x) => x !== h) }))}
                  className="px-2.5 py-1 rounded-full bg-surface-2 text-ink-mid text-xs font-medium hover:bg-border transition-colors"
                >
                  {h} ✕
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                aria-label="Nuevo interés"
                value={newHobby}
                maxLength={50}
                onChange={(e) => setNewHobby(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addHobby();
                  }
                }}
                placeholder="Agrega un interés…"
                className="max-w-[220px] px-3.5 py-2 border-[1.5px] border-border rounded-lg text-sm"
              />
              <button
                type="button"
                onClick={addHobby}
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
                checked={form.isVisible}
                onChange={(isVisible) => setForm((f) => ({ ...f, isVisible }))}
              />
              <PrivacyRow
                title="Recibir solicitudes de amistad"
                desc="Próximamente: por ahora cualquier estudiante puede enviarte una solicitud"
                checked
                disabled
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-amber text-forest hover:bg-amber-lt transition-colors disabled:opacity-60"
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
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

function Field({ label, hint, ...props }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink-mid">
        {label}
      </label>
      <input
        id={id}
        {...props}
        className="px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm focus:outline-none focus:border-forest-lt focus:ring-[3px] focus:ring-forest-lt/15 read-only:bg-surface read-only:text-muted"
      />
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </div>
  );
}

function BioField(props) {
  const id = useId();
  return (
    <>
      <label htmlFor={id} className="text-[13px] font-semibold text-ink-mid block mb-1.5">
        Bio breve
      </label>
      <textarea
        id={id}
        maxLength={1000}
        {...props}
        className="w-full px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm min-h-[90px] resize-y focus:outline-none focus:border-forest-lt focus:ring-[3px] focus:ring-forest-lt/15"
      />
    </>
  );
}

function PrivacyRow({ title, desc, checked, onChange, disabled }) {
  return (
    <div className="flex justify-between items-center gap-4">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted">{desc}</div>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} label={title} />
    </div>
  );
}
