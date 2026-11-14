import { ratingLabel } from '../../lib/map';
import Badge from '../Badge';

/** Tarjeta de un lugar. Tocarla lo muestra en el mapa. */
export default function ListingCard({ item, selected = false, onOpen, onReviews }) {
  const reviewable = (item.kind === 'comercio' || item.kind === 'alojamiento') && onReviews;
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
  if (!reviewable) return card;

  const label = ratingLabel(item.rating);
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
    </div>
  );
}
