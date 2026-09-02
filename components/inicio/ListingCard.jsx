import Badge from '../Badge';

export default function ListingCard({ item, onOpen }) {
  return (
    <div
      onClick={() => onOpen(item.id)}
      className="bg-white border-[1.5px] border-border rounded-lg overflow-hidden cursor-pointer transition-colors hover:border-forest-lt hover:shadow-card"
    >
      <div
        className="w-full h-[130px] flex items-center justify-center text-4xl text-border bg-surface-2"
        style={item.bg ? { background: item.bg } : undefined}
      >
        {item.emoji}
      </div>
      <div className="px-3.5 py-3">
        <div className="flex justify-between items-start mb-1">
          <span className="text-sm font-semibold text-ink">{item.name}</span>
          {item.price && (
            <span className="text-[13px] font-bold text-forest-mid">{item.price}</span>
          )}
        </div>
        <div className="text-xs text-muted mb-2">📍 {item.address}</div>
        <div className="flex justify-between items-center gap-2 flex-wrap">
          {item.stars && <span className="text-amber text-[13px]">{item.stars}</span>}
          {item.rating && <span className="text-xs text-muted">{item.rating}</span>}
          {item.footer && <span className="text-xs text-muted">{item.footer}</span>}
          {item.badge && <Badge text={item.badge.text} color={item.badge.color} />}
        </div>
      </div>
    </div>
  );
}
