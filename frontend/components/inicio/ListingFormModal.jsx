'use client';

import { useEffect, useRef, useState } from 'react';
import { AVAILABILITY_OPTIONS, validateListing } from '../../lib/listingForm';

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
 * Crear o editar un arriendo (solo administradores). El punto se puede marcar en el mapa
 * (`onPickLocation` oculta este formulario hasta que se toque el mapa) o escribir a mano.
 * Se monta con `key` para volver a empezar desde `initial` cuando cambia el punto.
 */
export default function ListingFormModal({ mode, initial, onSubmit, onCancel, onPickLocation }) {
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
  const hasPoint = validateListing({ ...values, name: 'xxx' }).errors?.location === undefined;

  const submit = async (e) => {
    e.preventDefault();
    const result = validateListing(values);
    setErrors(result.errors ?? {});
    setServerError('');
    if (!result.body) return;
    setBusy(true);
    try {
      await onSubmit(result.body);
    } catch (err) {
      setServerError(err.message || 'No pudimos guardar el arriendo.');
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
        aria-labelledby="listing-form-title"
        onSubmit={submit}
        noValidate
        className="bg-white rounded-lg p-5 sm:p-7 max-w-[560px] w-[92%] shadow-card-lg max-h-[90vh] overflow-y-auto flex flex-col gap-3.5"
      >
        <div className="flex justify-between items-start gap-3">
          <h2 id="listing-form-title" className="text-lg font-bold">
            {mode === 'edit' ? 'Editar arriendo' : 'Agregar arriendo'}
          </h2>
          <button type="button" onClick={onCancel} aria-label="Cerrar" className="text-2xl leading-none text-muted hover:text-ink px-1.5">
            ✕
          </button>
        </div>

        <Field id="listing-name" label="Nombre" error={errors.name}>
          <input ref={firstRef} id="listing-name" value={values.name} onChange={set('name')} maxLength={120} className={INPUT} placeholder="Ej.: Pieza en casa familiar" />
        </Field>
        <Field id="listing-address" label="Dirección" error={errors.address}>
          <input id="listing-address" value={values.address} onChange={set('address')} maxLength={200} className={INPUT} placeholder="Calle, número y comuna" />
        </Field>

        <fieldset className="border-[1.5px] border-border rounded-lg p-3 flex flex-col gap-2.5">
          <legend className="text-[13px] font-semibold px-1">Ubicación</legend>
          <div className="flex gap-2.5 flex-wrap">
            <div className="flex-1 min-w-[130px]">
              <label htmlFor="listing-lat" className="block text-xs text-muted mb-0.5">
                Latitud
              </label>
              <input id="listing-lat" inputMode="decimal" value={values.latitude} onChange={set('latitude')} className={INPUT} placeholder="-33.0437" />
            </div>
            <div className="flex-1 min-w-[130px]">
              <label htmlFor="listing-lng" className="block text-xs text-muted mb-0.5">
                Longitud
              </label>
              <input id="listing-lng" inputMode="decimal" value={values.longitude} onChange={set('longitude')} className={INPUT} placeholder="-71.6288" />
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => onPickLocation(values)}
              className="px-3 py-1.5 rounded-lg text-[13px] font-semibold border-[1.5px] border-forest-mid text-forest-mid hover:bg-surface-2"
            >
              📍 {hasPoint ? 'Cambiar punto en el mapa' : 'Elegir en el mapa'}
            </button>
            {hasPoint && <span className="text-xs text-forest-mid">Punto listo ✓</span>}
          </div>
          {errors.location && (
            <p role="alert" className="text-xs text-red-600">
              {errors.location}
            </p>
          )}
        </fieldset>

        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[150px]">
            <Field id="listing-price" label="Arriendo mensual (CLP)" error={errors.priceClp}>
              <input id="listing-price" inputMode="numeric" value={values.priceClp} onChange={set('priceClp')} className={INPUT} placeholder="250000" />
            </Field>
          </div>
          <div className="flex-1 min-w-[150px]">
            <Field id="listing-availability" label="Disponibilidad" error={errors.availability}>
              <select id="listing-availability" value={values.availability} onChange={set('availability')} className={INPUT}>
                {!AVAILABILITY_OPTIONS.includes(values.availability) && values.availability && (
                  <option value={values.availability}>{values.availability}</option>
                )}
                <option value="">Sin indicar</option>
                {AVAILABILITY_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <Field id="listing-description" label="Descripción" error={errors.description} hint="Qué incluye, con quién se comparte, gastos comunes…">
          <textarea id="listing-description" value={values.description} onChange={set('description')} rows={3} maxLength={1000} className={`${INPUT} resize-y`} />
        </Field>

        {serverError && (
          <p role="alert" className="text-[13px] text-red-600">
            {serverError}
          </p>
        )}
        <div className="flex gap-2.5 justify-end">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-[13px] font-semibold border border-border hover:bg-surface-2">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-forest-mid text-white hover:bg-forest-lt disabled:opacity-60"
          >
            {busy ? 'Guardando…' : mode === 'edit' ? 'Guardar cambios' : 'Publicar arriendo'}
          </button>
        </div>
      </form>
    </div>
  );
}
