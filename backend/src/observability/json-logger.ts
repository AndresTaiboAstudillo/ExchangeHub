import type { LogLevel, LoggerService } from '@nestjs/common';
import { currentRequestId } from './request-context.js';

const ORDER: LogLevel[] = ['verbose', 'debug', 'log', 'warn', 'error', 'fatal'];
const NAMES: Record<string, LogLevel> = {
  debug: 'debug',
  info: 'log',
  warn: 'warn',
  error: 'error',
};

type Method = 'log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal';
const LEVEL_NAME: Record<Method, string> = {
  verbose: 'debug',
  debug: 'debug',
  log: 'info',
  warn: 'warn',
  error: 'error',
  fatal: 'fatal',
};

/**
 * Registros estructurados: una línea JSON por evento, con el identificador de la petición.
 * El nivel mínimo se controla con LOG_LEVEL (debug, info, warn, error; por defecto info).
 */
export class JsonLogger implements LoggerService {
  private readonly threshold: number;

  constructor(
    level: string | undefined = process.env.LOG_LEVEL,
    private readonly write: (line: string) => void = (line) =>
      process.stdout.write(`${line}\n`),
    private readonly now: () => Date = () => new Date(),
  ) {
    this.threshold = ORDER.indexOf(
      NAMES[(level ?? 'info').toLowerCase()] ?? 'log',
    );
  }

  log(message: unknown, ...params: unknown[]) {
    this.emit('log', message, params);
  }
  error(message: unknown, ...params: unknown[]) {
    this.emit('error', message, params);
  }
  warn(message: unknown, ...params: unknown[]) {
    this.emit('warn', message, params);
  }
  debug(message: unknown, ...params: unknown[]) {
    this.emit('debug', message, params);
  }
  verbose(message: unknown, ...params: unknown[]) {
    this.emit('verbose', message, params);
  }
  fatal(message: unknown, ...params: unknown[]) {
    this.emit('fatal', message, params);
  }

  private emit(method: Method, message: unknown, params: unknown[]) {
    if (ORDER.indexOf(method) < this.threshold) return;
    // Nest pasa el contexto como último parámetro de texto; en error(), antes puede ir el stack.
    const strings = params.filter((p): p is string => typeof p === 'string');
    const context =
      strings.length > 0 ? strings[strings.length - 1] : undefined;
    const stack =
      method === 'error' && strings.length > 1 ? strings[0] : undefined;

    const fields =
      message !== null &&
      typeof message === 'object' &&
      !(message instanceof Error)
        ? (message as Record<string, unknown>)
        : {
            message:
              message instanceof Error ? message.message : String(message),
          };

    const record: Record<string, unknown> = {
      time: this.now().toISOString(),
      level: LEVEL_NAME[method],
      context,
      requestId: currentRequestId(),
      ...fields,
    };
    if (stack) record.stack = stack;
    try {
      this.write(JSON.stringify(record));
    } catch {
      // Una referencia circular no debe tumbar la petición que se estaba registrando.
      this.write(
        JSON.stringify({
          time: record.time,
          level: record.level,
          context,
          message: 'registro no serializable',
        }),
      );
    }
  }
}
