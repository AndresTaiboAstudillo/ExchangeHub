import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RateLimiter } from '../chat/rate-limiter.js';

export interface RateLimitRule {
  /** Nombre del contador (cada regla lleva el suyo). */
  name: string;
  max: number;
  windowMs: number;
  /** `ip`: por dirección. `ip+email`: por dirección y correo del cuerpo, contra la fuerza bruta a una cuenta. */
  by: 'ip' | 'ip+email';
}

const RATE_LIMIT_KEY = 'rate-limit-rules';
const PRUNE_ABOVE = 5_000;

/** Limita los intentos a un endpoint. Las reglas se aplican todas; basta que una se agote para responder 429. */
export const RateLimit = (...rules: RateLimitRule[]) =>
  SetMetadata(RATE_LIMIT_KEY, rules);

/**
 * Límite de intentos en memoria (una sola instancia del backend). Detrás de un proxy hay que definir
 * TRUST_PROXY; si no, todas las personas comparten la dirección del proxy. RATE_LIMIT_DISABLED=true
 * lo desactiva (solo para las pruebas automáticas).
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly limiters = new Map<string, RateLimiter>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (process.env.RATE_LIMIT_DISABLED === 'true') return true;
    const rules = this.reflector.get<RateLimitRule[] | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    if (!rules?.length) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<{
      setHeader(name: string, value: string): void;
    }>();
    const ip = request.ip ?? 'desconocida';
    const body = request.body as { email?: unknown } | undefined;
    const email =
      typeof body?.email === 'string'
        ? body.email.trim().toLowerCase().slice(0, 254)
        : '';

    let retryAfterMs = 0;
    for (const rule of rules) {
      const key = rule.by === 'ip' ? ip : `${ip}|${email}`;
      const id = `${rule.name}:${rule.by}`;
      let limiter = this.limiters.get(id);
      if (!limiter) {
        limiter = new RateLimiter(rule.max, rule.windowMs);
        this.limiters.set(id, limiter);
      }
      if (limiter.size > PRUNE_ABOVE) limiter.prune();
      if (!limiter.allow(key)) {
        retryAfterMs = Math.max(retryAfterMs, limiter.retryAfterMs(key));
      }
    }
    if (retryAfterMs > 0) {
      const seconds = Math.ceil(retryAfterMs / 1000);
      response.setHeader('Retry-After', String(seconds));
      throw new HttpException(
        `Demasiados intentos. Prueba de nuevo en ${Math.ceil(seconds / 60)} min.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
