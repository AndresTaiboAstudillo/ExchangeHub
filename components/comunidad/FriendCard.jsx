import Badge from '../Badge';

export default function FriendCard({ friend, onToast }) {
  return (
    <div className="flex flex-col items-start gap-2.5 bg-white rounded-lg p-4 shadow-card border-[1.5px] border-transparent hover:border-forest-lt transition-colors">
      <div className="flex gap-3 items-center w-full">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0"
          style={{ background: friend.color, color: friend.textColor || 'white' }}
        >
          {friend.initial}
        </div>
        <div>
          <div className="text-sm font-semibold">{friend.name}</div>
          <div className="text-xs text-muted mb-1 flex items-center gap-1.5">
            {friend.career} {friend.local && <Badge text="Local" color="green" className="!text-[10px] !py-0" />}
          </div>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap">
        {friend.langs.map((l) => (
          <span key={l} className="text-[11px] px-1.5 py-0.5 rounded-full bg-surface-2 text-ink-mid font-medium">
            {l}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {friend.hobbies.map((h) => (
          <span key={h} className="text-xs px-2.5 py-1 rounded-full bg-surface-2 text-ink-mid font-medium">
            {h}
          </span>
        ))}
      </div>

      <div className="flex gap-2 w-full">
        <button
          onClick={() => onToast(`Solicitud enviada a ${friend.name.split(' ')[0]}`)}
          className="flex-1 justify-center px-3.5 py-1.5 rounded-lg text-[13px] font-semibold bg-forest-mid text-white hover:bg-forest-lt transition-colors"
        >
          + Agregar
        </button>
        <button
          onClick={() => onToast(`Chat abierto con ${friend.name.split(' ')[0]}`)}
          className="px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border-[1.5px] border-border text-ink-mid hover:bg-surface-2 transition-colors"
        >
          💬 Chat
        </button>
      </div>
    </div>
  );
}
