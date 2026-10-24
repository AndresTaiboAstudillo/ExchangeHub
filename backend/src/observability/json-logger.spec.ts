import { describe, expect, it } from 'vitest';
import { JsonLogger } from './json-logger.js';
import { runWithRequestId } from './request-context.js';

function make(level?: string) {
  const lines: string[] = [];
  const logger = new JsonLogger(
    level,
    (l) => lines.push(l),
    () => new Date('2026-10-24T12:00:00Z'),
  );
  const parsed = () =>
    lines.map((l) => JSON.parse(l) as Record<string, unknown>);
  return { logger, lines, parsed };
}

describe('JsonLogger', () => {
  it('escribe una línea JSON con hora, nivel, contexto y mensaje', () => {
    const { logger, parsed } = make();
    logger.log('arrancó', 'Bootstrap');
    expect(parsed()).toEqual([
      {
        time: '2026-10-24T12:00:00.000Z',
        level: 'info',
        context: 'Bootstrap',
        message: 'arrancó',
      },
    ]);
  });

  it('incluye el identificador de la petición en curso', () => {
    const { logger, parsed } = make();
    runWithRequestId('req-123456789', () => logger.warn('algo raro', 'X'));
    expect(parsed()[0]).toMatchObject({
      level: 'warn',
      requestId: 'req-123456789',
    });
  });

  it('fusiona los campos de un mensaje objeto; el requestId explícito manda', () => {
    const { logger, parsed } = make();
    runWithRequestId('de-contexto-1', () =>
      logger.log(
        { message: 'http_request', status: 200, requestId: 'explicito-1' },
        'HTTP',
      ),
    );
    expect(parsed()[0]).toMatchObject({
      message: 'http_request',
      status: 200,
      requestId: 'explicito-1',
      context: 'HTTP',
    });
  });

  it('en error() separa el stack del contexto', () => {
    const { logger, parsed } = make();
    logger.error('falló', 'Error: x\n  at y', 'Servicio');
    expect(parsed()[0]).toMatchObject({
      level: 'error',
      context: 'Servicio',
      stack: 'Error: x\n  at y',
    });
  });

  it('respeta LOG_LEVEL', () => {
    const { logger, lines } = make('warn');
    logger.debug('no');
    logger.log('no');
    logger.warn('sí');
    logger.error('sí');
    expect(lines).toHaveLength(2);
  });

  it('un valor desconocido de nivel vuelve a info', () => {
    const { logger, lines } = make('ruidoso');
    logger.debug('no');
    logger.log('sí');
    expect(lines).toHaveLength(1);
  });

  it('no se cae con referencias circulares', () => {
    const { logger, parsed } = make();
    const circular: Record<string, unknown> = { message: 'ciclo' };
    circular.self = circular;
    logger.log(circular, 'X');
    expect(parsed()[0]).toMatchObject({ message: 'registro no serializable' });
  });

  it('las saltos de línea del mensaje quedan escapados dentro del JSON', () => {
    const { logger, lines } = make();
    logger.log('línea1\nfalsa: {"level":"error"}');
    expect(lines).toHaveLength(1);
  });
});
