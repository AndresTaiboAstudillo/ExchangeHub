'use client';

import Link from 'next/link';
import { initialOf, firstName, profileHref, timeAgo } from '../../lib/format';
import { NOTIFICATION_STYLES, notificationParts, previewOf } from '../../lib/chat';
import { useChat } from './ChatProvider';

function Row({ style, unread, onClick, children, time, actor, onProfile }) {
  return (
    <li className="flex items-stretch">
      <button
        type="button"
        onClick={onClick}
        className={`flex-1 min-w-0 flex items-start gap-3 pl-4 py-3 text-left transition-colors hover:bg-surface-2 ${
          unread ? 'bg-forest/5' : ''
        }`}
      >
        <span
          aria-hidden="true"
          className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0"
          style={{ background: style.background }}
        >
          {style.icon}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] leading-snug text-ink">{children}</span>
          <span className="block text-[11px] text-muted mt-0.5">{time}</span>
        </span>
        {unread && <span aria-label="Sin leer" className="w-2 h-2 rounded-full bg-forest-lt mt-2 flex-shrink-0" />}
      </button>
      {actor && (
        <Link
          href={profileHref(actor.id)}
          onClick={onProfile}
          aria-label={`Ver perfil de ${actor.name}`}
          title="Ver perfil"
          className="px-3.5 flex items-center text-base hover:bg-surface-2 transition-colors"
        >
          <span aria-hidden="true">👤</span>
        </Link>
      )}
    </li>
  );
}

/** Desplegable de notificaciones: mensajes sin leer arriba y luego la actividad reciente. */
export default function NotificationsPanel({ onClose }) {
  const { notifications, unreadConversations, notifUnread, markAllNotificationsRead, openNotification, openChat } = useChat();
  const hasUnread = notifUnread > 0 || unreadConversations.length > 0;
  const empty = notifications.length === 0 && unreadConversations.length === 0;

  return (
    <div
      role="dialog"
      aria-label="Notificaciones"
      className="fixed md:absolute inset-x-2 md:inset-x-auto md:right-0 top-[64px] md:top-[52px] md:w-[360px] bg-white rounded-lg shadow-card-lg border border-border z-[200] overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-bold">Notificaciones</h2>
        <button
          type="button"
          disabled={notifUnread === 0}
          onClick={markAllNotificationsRead}
          className="text-xs font-semibold text-forest-mid hover:underline disabled:text-muted disabled:no-underline"
        >
          Marcar todas como leídas
        </button>
      </div>

      <ul className="max-h-[60vh] overflow-y-auto list-none divide-y divide-border/60">
        {unreadConversations.map((c) => (
          <Row
            key={`msg-${c.friend.id}`}
            style={NOTIFICATION_STYLES.message}
            unread
            time={c.unreadCount > 1 ? `${c.unreadCount} mensajes nuevos` : 'mensaje nuevo'}
            actor={c.friend}
            onProfile={onClose}
            onClick={() => {
              openChat(c.friend);
              onClose();
            }}
          >
            <strong>{firstName(c.friend.name) || initialOf(c.friend.name)}</strong> te envió un mensaje
            {c.lastMessage && !c.lastMessage.mine ? `: "${previewOf(c.lastMessage.body, 70)}"` : ''}
          </Row>
        ))}

        {notifications.map((n) => {
          const { name, text } = notificationParts(n);
          return (
            <Row
              key={n.id}
              style={NOTIFICATION_STYLES[n.type] ?? NOTIFICATION_STYLES.message}
              unread={!n.readAt}
              time={timeAgo(n.createdAt)}
              actor={n.actor}
              onProfile={() => {
                openNotification(n, { navigate: false });
                onClose();
              }}
              onClick={() => {
                openNotification(n);
                if (n.postId) onClose();
              }}
            >
              <strong>{name}</strong>
              {text}
            </Row>
          );
        })}

        {empty && <li className="px-4 py-8 text-center text-sm text-muted">No tienes notificaciones.</li>}
      </ul>
      {!hasUnread && !empty && <p className="sr-only">Estás al día.</p>}
    </div>
  );
}
