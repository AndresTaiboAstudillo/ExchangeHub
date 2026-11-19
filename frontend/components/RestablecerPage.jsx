'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import AuthCard, { ErrorMessage, Field, submitClass } from './AuthCard';

const MIN_PASSWORD = 8;

export default function RestablecerPage({ token, onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <AuthCard title="Enlace no válido">
        <p className="text-sm text-ink mb-4">Este enlace está incompleto. Pide uno nuevo para continuar.</p>
        <Link href="/recuperar" className="text-sm font-semibold text-forest-mid hover:underline">
          Pedir un enlace nuevo
        </Link>
      </AuthCard>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.resetPassword(token, password);
      onDone();
    } catch (err) {
      setError(err.message || 'No se pudo completar la acción.');
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Elige una contraseña nueva" subtitle="Al cambiarla, se cerrarán tus otras sesiones.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="Contraseña nueva"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Field
          label="Repite la contraseña"
          type="password"
          name="confirm"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <ErrorMessage>
          {error}{' '}
          {/válido|venció/.test(error) && (
            <Link href="/recuperar" className="font-semibold underline">
              Pedir otro enlace
            </Link>
          )}
        </ErrorMessage>
        <button type="submit" disabled={busy} className={submitClass}>
          {busy ? 'Guardando…' : 'Cambiar contraseña'}
        </button>
      </form>
    </AuthCard>
  );
}
