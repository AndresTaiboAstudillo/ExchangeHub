'use client';

import { useState } from 'react';
import { api } from '../lib/api';
import AuthCard, { ErrorMessage, Field, submitClass } from './AuthCard';

export default function RecuperarPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err.message || 'No se pudo completar la acción.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthCard title="Revisa tu correo">
        <p role="status" className="text-sm text-ink leading-relaxed">
          Si <strong>{email.trim()}</strong> tiene una cuenta, te enviamos un enlace para elegir una contraseña nueva.
          Vale 30 minutos. Si no lo ves, revisa la carpeta de spam.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Recupera tu contraseña" subtitle="Escribe el correo de tu cuenta y te enviaremos un enlace.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="Correo electrónico"
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="tu@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <ErrorMessage>{error}</ErrorMessage>
        <button type="submit" disabled={busy} className={submitClass}>
          {busy ? 'Enviando…' : 'Enviar enlace'}
        </button>
      </form>
    </AuthCard>
  );
}
