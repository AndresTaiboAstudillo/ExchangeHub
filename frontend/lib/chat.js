// Lógica pura del chat y las notificaciones (sin React ni red), para poder probarla aparte.

export const MAX_MESSAGE_LENGTH = 2000;

/** Une mensajes (cronológicos) sin duplicar por id y los deja ordenados por fecha. */
export function mergeMessages(current, incoming) {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, { ...byId.get(m.id), ...m });
  return [...byId.values()].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt) || a.id.localeCompare(b.id),
  );
}

/** Texto corto para la lista de amigos: "Oye, ¿ya encontraste arriendo…". */
export function previewOf(text = '', max = 34) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Hora "10:42" de un mensaje. */
export function clockTime(iso) {
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Reglas de la caja de texto: devuelve el texto a enviar o null si no hay nada que enviar. */
export function draftToSend(draft) {
  const text = draft.trim();
  if (text.length === 0 || text.length > MAX_MESSAGE_LENGTH) return null;
  return text;
}

/** Actualiza la lista de amigos al llegar un mensaje. `viewing` = ese chat está abierto y visible. */
export function applyIncomingMessage(conversations, message, myId, viewing) {
  const friendId = message.conversationWith;
  const mine = message.senderId === myId;
  const next = conversations.map((c) => {
    if (c.friend.id !== friendId) return c;
    return {
      ...c,
      lastMessage: { body: message.body, createdAt: message.createdAt, mine },
      unreadCount: mine || viewing ? c.unreadCount : c.unreadCount + 1,
    };
  });
  // La conversación con actividad sube al principio.
  const index = next.findIndex((c) => c.friend.id === friendId);
  if (index > 0) next.unshift(...next.splice(index, 1));
  return next;
}

export const NOTIFICATION_STYLES = {
  friend_request: { icon: '👋', background: '#EDE9FE' },
  friend_accepted: { icon: '👫', background: '#EDE9FE' },
  post_like: { icon: '👍', background: '#DBEAFE' },
  post_reply: { icon: '💬', background: '#FEF3C7' },
  message: { icon: '💬', background: '#D1FAE5' },
};

/** Partes del texto de una notificación: el nombre va en negrita y el resto como texto. */
export function notificationParts(n) {
  const name = n.actor?.name ?? 'Alguien';
  switch (n.type) {
    case 'friend_request':
      return { name, text: ' te envió una solicitud de amistad' };
    case 'friend_accepted':
      return { name, text: ' aceptó tu solicitud de amistad' };
    case 'post_like':
      return { name, text: n.preview ? ` le dio like a tu publicación "${previewOf(n.preview, 60)}"` : ' le dio like a tu publicación' };
    case 'post_reply':
      return { name, text: n.preview ? ` respondió tu publicación: "${previewOf(n.preview, 80)}"` : ' respondió tu publicación' };
    default:
      return { name, text: '' };
  }
}
