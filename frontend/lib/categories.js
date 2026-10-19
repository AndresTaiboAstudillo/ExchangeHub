// Categorías del foro. El backend guarda el `id`; la interfaz muestra emoji y etiqueta.
export const CATEGORIES = [
  { id: 'arriendo', label: 'Arriendo', emoji: '🏠', color: 'green' },
  { id: 'hangout', label: 'Salidas / Planes', emoji: '🎉', color: 'amber' },
  { id: 'evento', label: 'Evento universitario', emoji: '🎓', color: 'purple' },
  { id: 'info', label: 'Info universitaria', emoji: 'ℹ️', color: 'blue' },
];

export const FORUM_FILTERS = [
  { id: 'todos', label: 'Todos' },
  ...CATEGORIES.map((c) => ({ id: c.id, label: `${c.emoji} ${c.label}` })),
];

export function categoryById(id) {
  return CATEGORIES.find((c) => c.id === id) ?? { id, label: id, emoji: '💬', color: 'green' };
}
