'use client';

import { useId, useMemo, useState } from 'react';
import { colorFor, firstName, initialOf } from '../../lib/format';
import { filterStudents } from '../../lib/students';
import FriendCard from './FriendCard';

const KINDS = [
  { value: 'todos', label: 'Todos' },
  { value: 'intercambio', label: 'Intercambio' },
  { value: 'local', label: 'Local (chileno)' },
];
const CAREERS = ['Ingeniería', 'Diseño', 'Derecho', 'Medicina'];
const LANGUAGE_FILTERS = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'Inglés' },
  { value: 'pt', label: 'Portugués' },
  { value: 'fr', label: 'Francés' },
];

const selectClass = 'max-w-[170px] px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm bg-white';

export default function AmigosTab({ social, onToast }) {
  const [filters, setFilters] = useState({ query: '', kind: 'todos', career: '', language: '' });
  const [busyId, setBusyId] = useState(null);
  const searchId = useId();

  const set = (name) => (e) => setFilters((f) => ({ ...f, [name]: e.target.value }));
  const students = useMemo(() => filterStudents(social.users, filters), [social.users, filters]);
  const received = social.friendships.filter((f) => f.direction === 'received' && f.status === 'pending');

  // Ejecuta una acción mostrando un aviso con el resultado.
  const act = async (id, action, successMessage) => {
    setBusyId(id);
    try {
      await action();
      if (successMessage) onToast(successMessage);
    } catch (err) {
      onToast(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const confirmRemove = (relation, person) => {
    const text =
      relation.status === 'accepted'
        ? `¿Quitar a ${firstName(person.name)} de tus amigos?`
        : '¿Cancelar la solicitud?';
    if (window.confirm(text)) act(person.id, () => social.remove(relation.id), 'Listo');
  };

  if (social.status === 'loading') return <p className="text-sm text-muted py-6">Cargando estudiantes…</p>;
  if (social.status === 'error') {
    return (
      <div role="alert" className="bg-white rounded-lg p-5 shadow-card text-sm">
        <p className="text-rose-800 mb-3">{social.error}</p>
        <button
          type="button"
          onClick={social.reload}
          className="px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div>
      {received.length > 0 && (
        <section aria-label="Solicitudes recibidas" className="mb-6">
          <h2 className="text-sm font-bold mb-3">Solicitudes de amistad ({received.length})</h2>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {received.map((f) => (
              <div key={f.id} className="flex items-center gap-3 bg-white rounded-lg p-3.5 shadow-card">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
                  style={{ background: colorFor(f.user.id) }}
                >
                  {initialOf(f.user.name)}
                </div>
                <div className="flex-1 min-w-0 text-sm font-semibold truncate">{f.user.name}</div>
                <button
                  type="button"
                  disabled={busyId === f.user.id}
                  onClick={() =>
                    act(f.user.id, () => social.respond(f.id, 'accepted'), `Ahora eres amigo de ${firstName(f.user.name)}`)
                  }
                  className="px-3 py-1 rounded-lg text-[13px] font-semibold bg-forest-mid text-white hover:bg-forest-lt transition-colors disabled:opacity-60"
                >
                  Aceptar
                </button>
                <button
                  type="button"
                  disabled={busyId === f.user.id}
                  onClick={() => act(f.user.id, () => social.respond(f.id, 'rejected'), 'Solicitud rechazada')}
                  className="px-3 py-1 rounded-lg text-[13px] font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors disabled:opacity-60"
                >
                  Rechazar
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-3.5 mb-5 flex-wrap">
        <div className="relative max-w-[300px] flex-1 min-w-[200px]">
          <span aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[15px] text-muted">
            🔍
          </span>
          <label htmlFor={searchId} className="sr-only">
            Buscar estudiantes
          </label>
          <input
            id={searchId}
            type="search"
            placeholder="Buscar por nombre, carrera…"
            value={filters.query}
            onChange={set('query')}
            className="w-full pl-9 pr-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm"
          />
        </div>
        <select aria-label="Tipo de estudiante" value={filters.kind} onChange={set('kind')} className={selectClass}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <select aria-label="Carrera" value={filters.career} onChange={set('career')} className={selectClass}>
          <option value="">Cualquier carrera</option>
          {CAREERS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select aria-label="Idioma" value={filters.language} onChange={set('language')} className={selectClass}>
          <option value="">Cualquier idioma</option>
          {LANGUAGE_FILTERS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {social.users.length === 0 && (
        <p className="text-sm text-muted">Aún no hay otros estudiantes registrados. ¡Invita a tus compañeros!</p>
      )}
      {social.users.length > 0 && students.length === 0 && (
        <p className="text-sm text-muted">Ningún estudiante coincide con tu búsqueda.</p>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {students.map((person) => {
          const relation = social.relations.get(person.id) ?? null;
          return (
            <FriendCard
              key={person.id}
              person={person}
              relation={relation}
              busy={busyId === person.id}
              onAdd={() =>
                act(person.id, () => social.sendRequest(person.id), `Solicitud enviada a ${firstName(person.name)}`)
              }
              onAccept={() =>
                act(person.id, () => social.respond(relation.id, 'accepted'), `Ahora eres amigo de ${firstName(person.name)}`)
              }
              onReject={() => act(person.id, () => social.respond(relation.id, 'rejected'), 'Solicitud rechazada')}
              onRemove={() => confirmRemove(relation, person)}
            />
          );
        })}
      </div>
    </div>
  );
}
