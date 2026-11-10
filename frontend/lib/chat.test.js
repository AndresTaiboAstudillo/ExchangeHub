import { applyIncomingMessage, draftToSend, mergeMessages, notificationParts, previewOf } from './chat';

const msg = (id, createdAt, extra = {}) => ({ id, createdAt, body: id, senderId: 'a', ...extra });

describe('mergeMessages', () => {
  it('une sin duplicar y ordena por fecha', () => {
    const merged = mergeMessages([msg('m2', '2026-01-01T10:02:00Z')], [msg('m1', '2026-01-01T10:01:00Z'), msg('m2', '2026-01-01T10:02:00Z')]);
    expect(merged.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('actualiza un mensaje existente (p. ej. al marcarse leído)', () => {
    const merged = mergeMessages([msg('m1', '2026-01-01T10:01:00Z')], [msg('m1', '2026-01-01T10:01:00Z', { readAt: 'x' })]);
    expect(merged).toHaveLength(1);
    expect(merged[0].readAt).toBe('x');
  });
});

describe('previewOf', () => {
  it('recorta con puntos suspensivos y colapsa espacios', () => {
    expect(previewOf('hola   mundo')).toBe('hola mundo');
    expect(previewOf('x'.repeat(50), 10)).toBe('xxxxxxxxx…');
  });
});

describe('draftToSend', () => {
  it('no envía vacío, solo espacios ni más de 2000 caracteres', () => {
    expect(draftToSend('')).toBeNull();
    expect(draftToSend('   ')).toBeNull();
    expect(draftToSend('x'.repeat(2001))).toBeNull();
    expect(draftToSend('  hola ')).toBe('hola');
  });
});

describe('applyIncomingMessage', () => {
  const conversations = [
    { friend: { id: 'f1' }, unreadCount: 0, lastMessage: null },
    { friend: { id: 'f2' }, unreadCount: 1, lastMessage: null },
  ];
  const incoming = { conversationWith: 'f2', senderId: 'f2', body: 'hola', createdAt: 't' };

  it('suma un no leído, actualiza el último mensaje y sube la conversación', () => {
    const next = applyIncomingMessage(conversations, incoming, 'me', false);
    expect(next[0].friend.id).toBe('f2');
    expect(next[0].unreadCount).toBe(2);
    expect(next[0].lastMessage).toMatchObject({ body: 'hola', mine: false });
  });

  it('no suma no leídos si el chat está abierto ni si el mensaje es mío', () => {
    expect(applyIncomingMessage(conversations, incoming, 'me', true)[0].unreadCount).toBe(1);
    expect(applyIncomingMessage(conversations, { ...incoming, senderId: 'me' }, 'me', false)[0].unreadCount).toBe(1);
  });
});

describe('notificationParts', () => {
  it('redacta cada tipo', () => {
    expect(notificationParts({ type: 'friend_accepted', actor: { name: 'Hana' } })).toEqual({ name: 'Hana', text: ' aceptó tu solicitud de amistad' });
    expect(notificationParts({ type: 'post_like', actor: { name: 'Priya' }, preview: 'El RUT' }).text).toContain('"El RUT"');
    expect(notificationParts({ type: 'post_reply', actor: null }).name).toBe('Alguien');
  });
});
