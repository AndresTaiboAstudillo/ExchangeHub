import FriendCard from './FriendCard';
import { friends } from '../../data/friends';

export default function AmigosTab({ onToast }) {
  return (
    <div>
      <div className="flex gap-3.5 mb-5 flex-wrap">
        <div className="relative max-w-[300px] flex-1 min-w-[200px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[15px] text-muted">🔍</span>
          <input
            type="text"
            placeholder="Buscar por nombre, carrera…"
            className="w-full pl-9 pr-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm"
          />
        </div>
        <select className="max-w-[160px] px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm bg-white">
          <option>Todos</option>
          <option>Intercambio</option>
          <option>Local (chileno)</option>
        </select>
        <select className="max-w-[160px] px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm bg-white">
          <option>Cualquier carrera</option>
          <option>Ingeniería</option>
          <option>Diseño</option>
          <option>Derecho</option>
          <option>Medicina</option>
        </select>
        <select className="max-w-[160px] px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm bg-white">
          <option>Cualquier idioma</option>
          <option>Español</option>
          <option>Inglés</option>
          <option>Portugués</option>
          <option>Francés</option>
        </select>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {friends.map((f) => (
          <FriendCard key={f.id} friend={f} onToast={onToast} />
        ))}
      </div>
    </div>
  );
}
