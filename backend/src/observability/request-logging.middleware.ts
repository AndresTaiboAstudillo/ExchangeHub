import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { httpMetrics } from './http-metrics.js';
import { runWithRequestId } from './request-context.js';

const ID_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;
const logger = new Logger('HTTP');

/**
 * Asigna (o acepta) un identificador de correlación, lo devuelve en `X-Request-Id`,
 * lo deja disponible para todo el procesamiento de la petición y registra al terminar
 * método, ruta, estado y duración. No se registra la query string ni el cuerpo.
 */
export function requestLogging(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.header('x-request-id');
  // Un valor del cliente solo se acepta si es inocuo: evita inyectar saltos de línea en los registros.
  const requestId =
    incoming && ID_PATTERN.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', requestId);
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs =
      Math.round(Number(process.hrtime.bigint() - startedAt) / 1e5) / 10;
    // La ruta es la plantilla (/universities/:id), no la URL real: pocas claves y sin datos del usuario.
    const route = (req.route as { path?: string } | undefined)?.path;
    const label = route ?? 'no-encontrada';
    httpMetrics.record(req.method, label, res.statusCode, durationMs);

    const event = {
      message: 'http_request',
      requestId,
      method: req.method,
      route: label,
      path: req.path,
      status: res.statusCode,
      duration_ms: durationMs,
    };
    if (res.statusCode >= 500) logger.error(event);
    else if (res.statusCode >= 400) logger.warn(event);
    else if (label.startsWith('/health') && label !== '/health/ready') {
      logger.debug(event); // el healthcheck de Docker llega cada pocos segundos
    } else logger.log(event);
  });

  runWithRequestId(requestId, next);
}
