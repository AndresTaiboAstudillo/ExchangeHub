'use client';

import { useState } from 'react';
import { starsText } from '../lib/map';

/** Estrellas de solo lectura: "★★★★☆". */
export function StarsDisplay({ value, className = '' }) {
  return (
    <span role="img" aria-label={`${value} de 5 estrellas`} className={`text-amber tracking-tight ${className}`}>
      {starsText(value)}
    </span>
  );
}

const LABELS = ['Malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente'];

/** Selector de 1 a 5 estrellas, usable con mouse, dedo y teclado. */
export default function StarInput({ value, onChange, disabled = false }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-2">
      <div role="radiogroup" aria-label="Calificación" className="flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}: ${LABELS[n - 1]}`}
            disabled={disabled}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            className={`text-[28px] leading-none px-0.5 transition-colors ${
              n <= shown ? 'text-amber' : 'text-border'
            } disabled:opacity-60`}
          >
            ★
          </button>
        ))}
      </div>
      <span className="text-xs text-muted min-w-[70px]">{shown ? LABELS[shown - 1] : 'Elige una nota'}</span>
    </div>
  );
}
