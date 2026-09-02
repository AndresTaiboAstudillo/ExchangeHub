import { universities } from '../data/universities';

export default function UniversidadesPage() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 py-7">
      <h1 className="font-serif text-[26px] mb-1">Universidades en Chile</h1>
      <p className="text-sm text-muted mb-6">
        Información de contacto, programas internacionales y recursos para estudiantes de intercambio
      </p>

      <div className="flex gap-2.5 mb-6 flex-wrap">
        <div className="relative max-w-[340px] flex-1 min-w-[220px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[15px] text-muted">🔍</span>
          <input
            type="text"
            placeholder="Buscar universidad…"
            className="w-full pl-9 pr-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm"
          />
        </div>
        <select className="max-w-[180px] px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm bg-white">
          <option>Todas las regiones</option>
          <option>Región de Valparaíso</option>
          <option>Región Metropolitana</option>
          <option>Biobío</option>
        </select>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {universities.map((u) => (
          <div
            key={u.id}
            className="bg-white rounded-lg shadow-card overflow-hidden border-[1.5px] border-transparent transition-all hover:border-forest-lt hover:shadow-card-lg cursor-pointer"
          >
            <div className="px-5 pt-5 pb-3.5 flex gap-3.5 items-start">
              <div
                className="w-[52px] h-[52px] rounded-xl flex-shrink-0 flex items-center justify-center text-lg font-bold text-white"
                style={{ background: u.crestColor }}
              >
                {u.crest}
              </div>
              <div>
                <h3 className="text-[15px] font-bold mb-0.5">{u.name}</h3>
                <p className="text-xs text-muted">{u.location}</p>
              </div>
            </div>
            <div className="px-5 pb-4 flex flex-col gap-2">
              <Detail icon="📍" text={u.address} />
              <Detail icon="📞" text={u.phone} />
              <Detail icon="🌐" text={u.site} />
              <Detail icon="✈️" text={u.exchange} />
            </div>
            <div className="flex flex-wrap gap-2 px-5 py-3.5 border-t border-border">
              {u.links.map((link) => (
                <a
                  key={link}
                  href="#"
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-surface-2 text-forest-mid hover:bg-emerald-100 transition-colors"
                >
                  {link}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Detail({ icon, text }) {
  return (
    <div className="flex gap-2 items-start text-[13px] text-ink-mid">
      <span className="flex-shrink-0 text-sm mt-px">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
