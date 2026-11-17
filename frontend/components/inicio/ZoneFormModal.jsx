'use client';

import { useEffect, useRef, useState } from 'react';
import { ZONE_RADIUS_M, validateZone } from '../../lib/zoneForm';

const INPUT = 'w-full px-3.5 py-2 border-[1.5px] border-border rounded-lg text-sm bg-white';

function Field({ id, label, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold mb-1">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted mt-1">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-red-600 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Agregar o editar una zona (solo administradores). Todas las zonas miden lo mismo: solo se elige el centro,
 * en el mapa (`onPickLocation` oculta este formulario hasta tocarlo) o escribiendo las coordenadas.
 */
export default function ZoneFormModal({ mode, initial, onSubmit, onCancel, onPickLocation }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));
  const hasPoint = validateZone({ ...values, name: 'xxx' }).errors?.location === undefined;

  const submit = async (e) => {
    e.preventDefault();
    const result = validateZone(values);
    setErrors(result.errors ?? {});
    setServerError('');
    if (!result.body) return;
    setBusy(true);
    try {
      await onSubmit(result.body);
    } catch (err) {
      setServerError(err.message || 'No pudimos guardar la zona.');
      setBusy(false);
    }
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      className="fixed inset-0 z-[1100] bg-black/45 backdrop-blur-sm flex items-center justify-center"
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="zone-form-title"
        onSubmit={submit}
        noValidate
        className="bg-white rounded-lg p-5 sm:p-7 max-w-[560px] w-[92%] shadow-card-lg max-h-[90vh] overflow-y-auto flex flex-col gap-3.5"
      >
        <div className="flex justify-between items-start gap-3">
          <h2 id="zone-form-title" className="text-lg font-bold">
            {mode === 'edit' ? 'Editar zona' : 'Agregar zona'}
          </h2>
          <button type="button" onClick={onCancel} aria-label="Cerrar" className="text-2xl leading-none text-muted hover:text-ink px-1.5">
            ✕
          </button>
        </div>

        <Field id="zone-name" label="Nombre" error={errors.name}>
          <input ref={firstRef} id="zone-name" value={values.name} onChange={set('name')} maxLength={80} className={INPUT} placeholder="Ej.: Cerro Alegre" />
        </Field>
        <Field id="zone-description" label="Descripción" error={errors.description} hint="Cómo es el barrio, qué se puede hacer, transporte…">
          <textarea id="zone-description" value={values.description} onChange={set('description')} rows={3} maxLength={500} className={`${INPUT} resize-y`} />
        </Field>
        <Field id="zone-hours" label="Horario recomendado" error={errors.safeHours} hint="Opcional. Ej.: Segura hasta las 23:00">
          <input id="zone-hours" value={values.safeHours} onChange={set('safeHours')} maxLength={80} className={INPUT} />
        </Field>

        <fieldset className="border-[1.5px] border-border rounded-lg p-3 flex flex-col gap-2.5">
          <legend className="text-[13px] font-semibold px-1">Centro de la zona</legend>
          <p className="text-xs text-muted">Todas las zonas cubren la misma área ({ZONE_RADIUS_M} m a la redonda).</p>
          <div className="flex gap-2.5 flex-wrap">
            <div className="flex-1 min-w-[130px]">
              <label htmlFor="zone-lat" className="block text-xs text-muted mb-0.5">
                Latitud
              </label>
              <input id="zone-lat" inputMode="decimal" value={values.latitude} onChange={set('latitude')} className={INPUT} placeholder="-33.0425" />
            </div>
            <div className="flex-1 min-w-[130px]">
              <label htmlFor="zone-lng" className="block text-xs text-muted mb-0.5">
                Longitud
              </label>
              <input id="zone-lng" inputMode="decimal" value={values.longitude} onChange={set('longitude')} className={INPUT} placeholder="-71.6290" />
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => onPickLocation(values)}
              className="px-3 py-1.5 rounded-lg text-[13px] font-semibold border-[1.5px] border-forest-mid text-forest-mid hover:bg-surface-2"
            >
              📍 {hasPoint ? 'Cambiar centro en el mapa' : 'Elegir en el mapa'}
            </button>
            {hasPoint && <span className="text-xs text-forest-mid">Centro listo ✓</span>}
          </div>
          {errors.location && (
            <p role="alert" className="text-xs text-red-600">
              {errors.location}
            </p>
          )}
        </fieldset>

        {serverError && (
          <p role="alert" className="text-[13px] text-red-600">
            {serverError}
          </p>
        )}
        <div className="flex gap-2.5 justify-end">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-[13px] font-semibold border border-border hover:bg-surface-2">
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-forest-mid text-white hover:bg-forest-lt disabled:opacity-60">
            {busy ? 'Guardando…' : mode === 'edit' ? 'Guardar cambios' : 'Agregar zona'}
          </button>
        </div>
      </form>
    </div>
  );
}
