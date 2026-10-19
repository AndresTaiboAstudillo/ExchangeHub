import { colorFor, initialOf } from '../../lib/format';
import { isLocal } from '../../lib/students';
import Badge from '../Badge';

const secondary =
  'px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors disabled:opacity-60';
const primary =
  'flex-1 justify-center px-3.5 py-1.5 rounded-lg text-[13px] font-semibold bg-forest-mid text-white hover:bg-forest-lt transition-colors disabled:opacity-60';

/**
 * `relation` es la relación con esta persona: null (ninguna) o { id, status, direction }.
 * El estado "rechazada" no llega aquí: quien envía no la ve (lo decide el backend).
 */
export default function FriendCard({ person, relation, busy = false, onAdd, onAccept, onReject, onRemove }) {
  const careerLine = [person.career, person.countryOfOrigin].filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col items-start gap-2.5 bg-white rounded-lg p-4 shadow-card border-[1.5px] border-transparent hover:border-forest-lt transition-colors">
      <div className="flex gap-3 items-center w-full">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-base text-white flex-shrink-0"
          style={{ background: colorFor(person.id) }}
        >
          {initialOf(person.name)}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{person.name}</div>
          <div className="text-xs text-muted mb-1 flex items-center gap-1.5 flex-wrap">
            {careerLine || 'Estudiante'}
            {isLocal(person) && <Badge text="Local" color="green" className="!text-[10px] !py-0" />}
          </div>
        </div>
      </div>

      {person.languages.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {person.languages.map((code) => (
            <span key={code} className="text-[11px] px-1.5 py-0.5 rounded-full bg-surface-2 text-ink-mid font-medium">
              {code.toUpperCase()}
            </span>
          ))}
        </div>
      )}

      {person.hobbies.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {person.hobbies.map((h) => (
            <span key={h} className="text-xs px-2.5 py-1 rounded-full bg-surface-2 text-ink-mid font-medium">
              {h}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 w-full">
        {!relation && (
          <button type="button" className={primary} disabled={busy} onClick={onAdd}>
            + Agregar
          </button>
        )}

        {relation?.status === 'pending' && relation.direction === 'sent' && (
          <>
            <button type="button" className={primary} disabled>
              Solicitud enviada
            </button>
            <button type="button" className={secondary} disabled={busy} onClick={onRemove}>
              Cancelar
            </button>
          </>
        )}

        {relation?.status === 'pending' && relation.direction === 'received' && (
          <>
            <button type="button" className={primary} disabled={busy} onClick={onAccept}>
              Aceptar
            </button>
            <button type="button" className={secondary} disabled={busy} onClick={onReject}>
              Rechazar
            </button>
          </>
        )}

        {relation?.status === 'accepted' && (
          <>
            <button type="button" className={primary} disabled>
              ✓ Amigos
            </button>
            <button type="button" className={secondary} disabled={busy} onClick={onRemove}>
              Quitar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
