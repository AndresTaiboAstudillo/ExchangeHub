'use client';

import { useState } from 'react';
import { api } from '../lib/api';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Resumen de lo que se borraría junto con la cuenta. */
function contentSummary(c) {
  const parts = [
    plural(c.posts, 'publicación', 'publicaciones'),
    plural(c.replies, 'comentario', 'comentarios'),
    plural(c.reviews, 'reseña', 'reseñas'),
    plural(c.listings, 'arriendo', 'arriendos'),
    plural(c.messages, 'mensaje', 'mensajes'),
  ];
  return parts.join(', ');
}

/** Administración: por ahora, una sola acción: eliminar a una persona por su correo. */
export default function AdministracionPage() {
  const [email, setEmail] = useState('');
  const [target, setTarget] = useState(null); // quién se va a eliminar, a la espera de confirmar
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const reset = () => {
    setTarget(null);
    setError('');
  };

  const lookup = async (e) => {
    e.preventDefault();
    setDone('');
    setError('');
    setBusy(true);
    try {
      setTarget(await api.adminUser(email.trim()));
    } catch (err) {
      setTarget(null);
      setError(err.message || 'No pudimos buscar a esa persona.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.adminDeleteUser(target.email);
      setDone(`Se eliminó a ${res.deleted.name} y todo lo que publicó.`);
      setTarget(null);
      setEmail('');
    } catch (err) {
      setError(err.message || 'No pudimos eliminar la cuenta.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-[640px] mx-auto px-4 py-8">
      <h1 className="font-serif text-2xl mb-1">Administración</h1>

      <section className="bg-white rounded-lg shadow-card p-5 sm:p-6" aria-labelledby="eliminar-usuario">
        <h2 id="eliminar-usuario" className="text-base font-bold mb-1">
          Eliminar usuario
        </h2>
        <p className="text-[13px] text-muted mb-4">
          Escribe el correo de la persona. Se eliminará su cuenta y todo lo que publicó: publicaciones, comentarios,
          reseñas, arriendos y mensajes. No se puede deshacer.
        </p>

        <form onSubmit={lookup} className="flex gap-2 flex-wrap">
          <label htmlFor="admin-email" className="sr-only">
            Correo de la persona
          </label>
          <input
            id="admin-email"
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              reset();
            }}
            placeholder="correo@ejemplo.cl"
            autoComplete="off"
            className="flex-1 min-w-[220px] px-3.5 py-2 border-[1.5px] border-border rounded-lg text-sm"
          />
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-rose-700 text-white hover:bg-rose-800 disabled:opacity-60"
          >
            Eliminar usuario
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-3 text-[13px] text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="mt-3 text-[13px] text-forest-mid bg-surface border border-border rounded-lg px-3 py-2">
            {done}
          </p>
        )}

        {target && (
          <div role="alertdialog" aria-labelledby="confirm-title" className="mt-4 border-[1.5px] border-rose-300 bg-rose-50 rounded-lg p-4">
            <p id="confirm-title" className="text-sm font-semibold mb-1">
              ¿Eliminar a {target.name}?
            </p>
            <p className="text-[13px] text-ink-mid mb-1">{target.email}</p>
            <p className="text-[13px] text-ink-mid mb-3">
              También se borrará: {contentSummary(target.content)}. Sus amistades y conversaciones también desaparecerán.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirm}
                disabled={busy}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-rose-700 text-white hover:bg-rose-800 disabled:opacity-60"
              >
                {busy ? 'Eliminando…' : 'Sí, eliminar definitivamente'}
              </button>
              <button type="button" onClick={reset} disabled={busy} className="px-4 py-2 rounded-lg text-[13px] font-semibold border border-border bg-white hover:bg-surface-2">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
