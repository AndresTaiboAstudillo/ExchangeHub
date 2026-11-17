import { directionsUrl, ratingLabel } from './map';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text; // textContent: los nombres de OpenStreetMap no son de confianza
  return node;
}

function link(href, text) {
  const a = el('a', 'eh-popup-link', text);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

/** Contenido del globo de un lugar, armado con el DOM (nunca con HTML en texto). */
export function buildPopup(item, { onReviews } = {}) {
  const root = el('div', 'eh-popup');
  root.appendChild(el('strong', 'eh-popup-title', `${item.emoji} ${item.name}`));
  if (item.badge) root.appendChild(el('span', 'eh-popup-badge', item.badge.text));
  if (item.price) root.appendChild(el('div', 'eh-popup-price', item.price));
  if (item.address) root.appendChild(el('div', 'eh-popup-line', `📍 ${item.address}`));
  const rating = ratingLabel(item.rating);
  if (rating) root.appendChild(el('div', 'eh-popup-rating', rating));
  if (item.footer) root.appendChild(el('div', 'eh-popup-line', item.footer));
  if (item.description) root.appendChild(el('div', 'eh-popup-desc', item.description));

  const actions = el('div', 'eh-popup-actions');
  if ((item.kind === 'comercio' || item.kind === 'alojamiento' || item.kind === 'zona') && onReviews) {
    const button = el('button', 'eh-popup-link eh-popup-button', rating ? 'Ver reseñas' : 'Reseñar');
    button.type = 'button';
    button.addEventListener('click', () => onReviews(item.id));
    actions.appendChild(button);
  }
  actions.appendChild(link(directionsUrl(item.lat, item.lng), 'Cómo llegar'));
  if (item.website && /^https?:\/\//i.test(item.website)) actions.appendChild(link(item.website, 'Sitio web'));
  root.appendChild(actions);
  return root;
}
