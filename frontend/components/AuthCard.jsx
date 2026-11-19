import Link from 'next/link';
import { useId } from 'react';

/** Marco de las pantallas de recuperación de contraseña (fuera de la app con sesión). */
export default function AuthCard({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6 py-14">
      <div className="w-full max-w-[380px]">
        <div className="font-serif text-2xl text-forest mb-6">
          Exchange<span className="text-amber">Hub</span>
        </div>
        <h1 className="font-serif text-[26px] mb-1.5 text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-muted mb-6">{subtitle}</p>}
        {children}
        <p className="mt-6 text-center">
          <Link href="/login" className="text-[13px] text-forest-mid hover:underline">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

export function Field({ label, ...props }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink-mid">
        {label}
      </label>
      <input
        id={id}
        {...props}
        className="px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm bg-white text-ink focus:outline-none focus:border-forest-lt focus:ring-[3px] focus:ring-forest-lt/15 transition-colors"
      />
    </div>
  );
}

export function ErrorMessage({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-[13px] text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
      {children}
    </p>
  );
}

export const submitClass =
  'w-full flex justify-center items-center gap-1.5 py-2.5 px-5 rounded-lg text-sm font-semibold bg-forest-mid text-white hover:bg-forest-lt transition-colors active:scale-[.97] disabled:opacity-60 disabled:cursor-not-allowed';
