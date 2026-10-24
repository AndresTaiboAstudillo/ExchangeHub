import { colorFor } from "../../lib/format";
import {
  categoryLabel,
  crestOf,
  mapUrl,
  ownershipLabel,
  safeWebsite,
  statusInfo,
  websiteLabel,
} from "../../lib/universities";
import Badge from "../Badge";

export default function UniversityCard({ university: u }) {
  const site = u.website ? safeWebsite(u.website) : null;
  const map = mapUrl(u.latitude, u.longitude);
  const status = statusInfo(u);

  return (
    <article className="bg-white rounded-lg shadow-card overflow-hidden border-[1.5px] border-transparent transition-all hover:border-forest-lt hover:shadow-card-lg flex flex-col">
      <div className="px-5 pt-5 pb-3 flex gap-3.5 items-start">
        <div
          aria-hidden="true"
          className="w-[52px] h-[52px] rounded-xl flex-shrink-0 flex items-center justify-center text-lg font-bold text-white"
          style={{ background: colorFor(u.registryNumber ?? u.id) }}
        >
          {crestOf(u.name)}
        </div>
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold mb-1.5 leading-snug">
            {u.name}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {categoryLabel(u.category) && (
              <Badge text={categoryLabel(u.category)} color="blue" />
            )}
            {ownershipLabel(u.ownership) && (
              <Badge text={ownershipLabel(u.ownership)} color="green" />
            )}
            {status && <Badge text={status.text} color={status.color} />}
          </div>
        </div>
      </div>

      <dl className="px-5 pb-4 flex flex-col gap-2 text-[13px] text-ink-mid flex-1">
        {site && (
          <Row icon="🌐" label="Sitio web">
            <a
              href={site}
              target="_blank"
              rel="noopener noreferrer"
              className="text-forest-mid font-medium hover:underline break-all"
            >
              {websiteLabel(site)}
            </a>
          </Row>
        )}
        {u.foundedYear && (
          <Row icon="🏛️" label="Fundación">
            Fundada en {u.foundedYear}
          </Row>
        )}
        {map && (
          <Row icon="📍" label="Ubicación">
            <a
              href={map}
              target="_blank"
              rel="noopener noreferrer"
              className="text-forest-mid font-medium hover:underline"
            >
              Ver en el mapa
            </a>
          </Row>
        )}
        {u.registryNumber && (
          <Row icon="🔖" label="N.º de registro">
            {u.registryNumber} (Mineduc)
          </Row>
        )}
        {!site && !map && !u.foundedYear && (
          <p className="text-xs text-muted">
            Aún no hay más datos públicos recopilados para esta institución.
          </p>
        )}
      </dl>
    </article>
  );
}

function Row({ icon, label, children }) {
  return (
    <div className="flex gap-2 items-start">
      <dt className="flex-shrink-0 text-sm mt-px" title={label}>
        <span aria-hidden="true">{icon}</span>
        <span className="sr-only">{label}</span>
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
