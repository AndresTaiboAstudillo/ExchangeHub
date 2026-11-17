'use client';

import { useRef, useState } from 'react';
import { api } from '../../lib/api';
import { ACCEPTED_TYPES, fileToAvatarDataUrl } from '../../lib/avatarImage';
import { avatarSrc } from '../../lib/format';
import Avatar from '../Avatar';

const button =
  'px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors disabled:opacity-60';

/** Foto de perfil con "Cambiar foto" y "Quitar foto". `onChange` recibe el perfil ya actualizado. */
export default function AvatarEditor({ user, onChange, onToast }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const run = async (action, success) => {
    setBusy(true);
    try {
      onChange(await action());
      onToast(success);
    } catch (err) {
      onToast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (!file) return;
    run(async () => api.setAvatar(await fileToAvatarDataUrl(file)), 'Foto actualizada ✓');
  };

  return (
    <div className="mb-3">
      <Avatar person={user} className="w-24 h-24 text-4xl mx-auto mb-3" />
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={onFile}
        aria-label="Elegir foto de perfil"
        className="sr-only"
        tabIndex={-1}
      />
      <div className="flex gap-2 justify-center flex-wrap">
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className={button}>
          {busy ? 'Subiendo…' : '📷 Cambiar foto'}
        </button>
        {avatarSrc(user) && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => api.removeAvatar(), 'Foto eliminada')}
            className={button}
          >
            Quitar foto
          </button>
        )}
      </div>
    </div>
  );
}
