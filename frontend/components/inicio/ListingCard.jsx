import { useState } from 'react';
import { ratingLabel } from '../../lib/map';
import Badge from '../Badge';

/** Editar y eliminar un arriendo (solo administradores). Eliminar pide confirmación en la misma tarjeta. */
function AdminActions({ item, onEdit, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    try {
      await onDelete(item.id);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };
  const btn = 'px-2 py-0.5 rounded hover:bg-surface-2 disabled:opacity-60';
  return (
    <div className="flex justify-end items-center gap-1 mt-1 text-xs text-muted">
      {confirming ? (
        <>
          <span>{item.kind === 'zona' ? '¿Eliminar esta zona y sus reseñas?' : '¿Eliminar este arriendo y sus reseñas?'}</span>
          <button type="button" onClick={remove} disabled={busy} className={`${btn} font-semibold text-red-600`}>
            Sí, eliminar
          </button>
          <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={btn}>
            No
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={() => onEdit(item)} aria-label={`Editar ${item.name}`} className={btn}>
            ✏️ Editar
          </button>
          <button type="button" onClick={() => setConfirming(true)} aria-label={`Eliminar ${item.name}`} className={btn}>
            🗑 Eliminar
          </button>
        </>
      )}
    </div>
  );
}

/** Tarjeta de un lugar. Tocarla lo muestra en el mapa. */
export default function ListingCard({ item, selected = false, onOpen, onReviews, onEdit, onDelete }) {
  const manageable = Boolean(onEdit && onDelete && (item.reviewTarget === 'listing' || item.reviewTarget === 'zone'));
  const reviewable = (item.kind === 'comercio' || item.kind === 'alojamiento' || item.kind === 'zona') && onReviews;
  const card = (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      aria-pressed={selected}
      className={`w-full text-left bg-white border-[1.5px] rounded-lg overflow-hidden transition-colors hover:border-forest-lt hover:shadow-card ${
        selected ? 'border-forest-mid shadow-card' : 'border-border'
      } ${reviewable ? 'rounded-b-none' : ''}`}
    >
      <div className="flex items-center gap-3 px-3.5 py-3">
        <div
          aria-hidden="true"
          className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0 bg-surface-2"
          style={item.background ? { background: item.background } : undefined}
        >
          {item.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex justify-between items-start gap-2 mb-0.5">
            <span className="text-sm font-semibold text-ink truncate">{item.name}</span>
            {item.price && <span className="text-[13px] font-bold text-forest-mid whitespace-nowrap">{item.price}</span>}
          </div>
          {item.address && <div className="text-xs text-muted truncate">📍 {item.address}</div>}
          <div className="flex justify-between items-center gap-2 flex-wrap mt-1.5">
            {item.footer && <span className="text-xs text-muted">{item.footer}</span>}
            {item.badge && <Badge text={item.badge.text} color={item.badge.color} />}
          </div>
        </div>
      </div>
    </button>
  );
  if (!reviewable && !manageable) return card;

  const label = ratingLabel(item.rating);
  const admin = manageable && <AdminActions item={item} onEdit={onEdit} onDelete={onDelete} />;
  if (!reviewable) {
    return (
      <div>
        {card}
        {admin}
      </div>
    );
  }
  return (
    <div>
      {card}
      <button
        type="button"
        onClick={() => onReviews(item.id)}
        aria-label={`Reseñas de ${item.name}`}
        className="w-full flex justify-between items-center gap-2 px-3.5 py-2 text-xs bg-surface border-[1.5px] border-t-0 border-border rounded-b-lg hover:bg-surface-2 transition-colors"
      >
        <span className={label ? 'font-semibold text-amber-700' : 'text-muted'}>{label ?? '☆ Sin reseñas todavía'}</span>
        <span className="font-semibold text-forest-mid">{label ? 'Ver reseñas' : 'Sé la primera persona en opinar'}</span>
      </button>
      {admin}
    </div>
  );
}
