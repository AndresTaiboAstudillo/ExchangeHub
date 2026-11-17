'use client';

import { useState } from 'react';
import { avatarSrc, colorFor, initialOf } from '../lib/format';

/**
 * Foto de perfil de una persona ({ id, name, avatarUpdatedAt }); si no tiene foto o no carga,
 * muestra su inicial sobre un color propio. `className` fija el tamaño y el texto de la inicial.
 */
export default function Avatar({ person, className = 'w-10 h-10 text-base', children }) {
  const src = avatarSrc(person);
  const [failedSrc, setFailedSrc] = useState(null);
  const showPhoto = src && failedSrc !== src;
  return (
    <span
      className={`flex items-center justify-center font-bold text-white flex-shrink-0 rounded-full ${className}`}
      style={{ background: colorFor(person?.id ?? 'anonimo') }}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto servida por la API, redimensionada al subirla
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailedSrc(src)}
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        initialOf(person?.name)
      )}
      {children}
    </span>
  );
}
