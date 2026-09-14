import { mapPins, mapLabels } from '../../data/listings';

const PIN_COLOR = {
  forest: 'bg-forest-mid',
  amber: 'bg-amber',
  green: 'bg-emerald-600',
};

export default function MapPanel({ onOpen }) {
  return (
    <div className="relative bg-[#E8F0E9] overflow-hidden">
      <div className="w-full h-full flex flex-col items-center justify-center relative">
        {/* grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(107,142,90,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(107,142,90,.15) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        {/* fake roads */}
        <div className="absolute left-0 right-0 h-[3px] bg-white/70" style={{ top: '32%' }} />
        <div className="absolute left-0 right-0 h-[3px] bg-white/70" style={{ top: '58%' }} />
        <div className="absolute left-0 right-0 h-[3px] bg-white/70" style={{ top: '75%' }} />
        <div className="absolute top-0 bottom-0 w-[3px] bg-white/70" style={{ left: '30%' }} />
        <div className="absolute top-0 bottom-0 w-[3px] bg-white/70" style={{ left: '55%' }} />
        <div className="absolute top-0 bottom-0 w-[3px] bg-white/70" style={{ left: '72%' }} />

        {/* pins */}
        {mapPins.map((pin) => (
          <button
            key={pin.id}
            title={pin.label}
            onClick={() => onOpen(pin.id)}
            className={`absolute w-8 h-8 text-white flex items-center justify-center shadow-[0_3px_8px_rgba(0,0,0,.25)] transition-transform hover:scale-[1.15] ${PIN_COLOR[pin.color]}`}
            style={{
              top: pin.top,
              left: pin.left,
              borderRadius: '50% 50% 50% 0',
              transform: 'rotate(-45deg)',
            }}
          >
            <span style={{ transform: 'rotate(45deg)' }} className="text-sm">
              {pin.emoji}
            </span>
          </button>
        ))}

        {/* labels */}
        {mapLabels.map((l) => (
          <div
            key={l.text}
            className="absolute text-[11px] font-bold text-forest-mid bg-white/75 px-2 py-0.5 rounded-md"
            style={{ top: l.top, left: l.left }}
          >
            {l.text}
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-1.5">
        {['+', '−', '◎'].map((s, i) => (
          <div
            key={i}
            title={i === 0 ? 'Acercar' : i === 1 ? 'Alejar' : 'Mi ubicación'}
            className="w-9 h-9 bg-white border-[1.5px] border-border rounded-lg flex items-center justify-center text-lg cursor-pointer shadow-card hover:bg-surface-2"
          >
            {s}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg px-3.5 py-2.5 shadow-card flex flex-col gap-1.5">
        <div className="text-[11px] font-bold text-ink-mid mb-1">Leyenda</div>
        <LegendItem color="bg-forest-mid" label="Alojamiento" />
        <LegendItem color="bg-amber" label="Comercio" />
        <LegendItem color="bg-emerald-600" label="Zona segura" />
        <LegendItem color="bg-amber-600" label="Precaución" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${color}`} />
      {label}
    </div>
  );
}
