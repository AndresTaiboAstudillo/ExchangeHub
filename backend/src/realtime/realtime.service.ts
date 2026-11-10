import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

/** Sala privada de cada usuario: todos sus dispositivos/pestañas se unen a ella. */
export const userRoom = (userId: string) => `user:${userId}`;

/**
 * Puente entre los servicios y Socket.IO. El gateway le entrega el servidor al iniciar; así los
 * servicios (chat, notificaciones) pueden avisar a un usuario sin depender del gateway.
 * Guarda además quién está conectado (una instancia del backend: sin Redis).
 */
@Injectable()
export class RealtimeService {
  private server: Server | null = null;
  private readonly connections = new Map<string, number>();

  attach(server: Server): void {
    this.server = server;
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(userRoom(userId)).emit(event, payload);
  }

  isOnline(userId: string): boolean {
    return (this.connections.get(userId) ?? 0) > 0;
  }

  /** Devuelve true si es la primera conexión del usuario (pasó a estar en línea). */
  connected(userId: string): boolean {
    const n = this.connections.get(userId) ?? 0;
    this.connections.set(userId, n + 1);
    return n === 0;
  }

  /** Devuelve true si era la última conexión (pasó a estar desconectado). */
  disconnected(userId: string): boolean {
    const n = this.connections.get(userId) ?? 0;
    if (n <= 1) {
      this.connections.delete(userId);
      return n === 1;
    }
    this.connections.set(userId, n - 1);
    return false;
  }
}
