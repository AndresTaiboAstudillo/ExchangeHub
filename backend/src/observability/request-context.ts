import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Identificador de correlación de la petición en curso (o `undefined` fuera de una). */
export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return storage.run({ requestId }, fn);
}

/** Para trabajos sin petición HTTP (p. ej. la ingesta programada). */
export function runWithNewRequestId<T>(fn: () => T): T {
  return runWithRequestId(randomUUID(), fn);
}
