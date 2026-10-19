'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

/**
 * Estudiantes y amistades del usuario, más las acciones para enviar, responder y eliminar
 * solicitudes. `onFriendsChanged` avisa cuando cambia la cantidad de amigos (para refrescar el perfil).
 */
export function useSocial({ onFriendsChanged } = {}) {
  const [users, setUsers] = useState([]);
  const [friendships, setFriendships] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.users(), api.friendships()]).then(
      ([loadedUsers, loadedFriendships]) => {
        if (cancelled) return;
        setUsers(loadedUsers);
        setFriendships(loadedFriendships);
        setError('');
        setStatus('ready');
      },
      (err) => {
        if (cancelled) return;
        setError(err.message);
        setStatus('error');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = useCallback(() => {
    setStatus('loading');
    setReloadKey((k) => k + 1);
  }, []);

  const reloadFriendships = useCallback(async () => {
    setFriendships(await api.friendships());
  }, []);

  const sendRequest = useCallback(
    async (userId) => {
      await api.requestFriendship(userId);
      await reloadFriendships();
    },
    [reloadFriendships],
  );

  const respond = useCallback(
    async (friendshipId, newStatus) => {
      await api.respondFriendship(friendshipId, newStatus);
      await reloadFriendships();
      if (onFriendsChanged) onFriendsChanged();
    },
    [reloadFriendships, onFriendsChanged],
  );

  const remove = useCallback(
    async (friendshipId) => {
      await api.removeFriendship(friendshipId);
      await reloadFriendships();
      if (onFriendsChanged) onFriendsChanged();
    },
    [reloadFriendships, onFriendsChanged],
  );

  // Relación con cada persona: { id (de la amistad), status, direction } o ausente.
  const relations = useMemo(() => {
    const map = new Map();
    for (const f of friendships) {
      map.set(f.user.id, { id: f.id, status: f.status, direction: f.direction });
    }
    return map;
  }, [friendships]);

  const friends = useMemo(
    () => friendships.filter((f) => f.status === 'accepted').map((f) => f.user),
    [friendships],
  );

  return { users, friendships, relations, friends, status, error, reload, sendRequest, respond, remove };
}
