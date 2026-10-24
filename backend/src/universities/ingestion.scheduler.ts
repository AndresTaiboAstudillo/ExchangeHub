import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { runWithNewRequestId } from '../observability/request-context.js';
import { IngestionService } from './ingestion.service.js';

/**
 * Revisión periódica de las fuentes. Desactivada por defecto:
 * se activa con INGESTION_INTERVAL_HOURS (p. ej. 168 = una vez por semana).
 */
@Injectable()
export class IngestionScheduler
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(IngestionScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly ingestion: IngestionService) {}

  onApplicationBootstrap() {
    const hours = Number(process.env.INGESTION_INTERVAL_HOURS ?? 0);
    if (!Number.isFinite(hours) || hours <= 0) return;
    this.logger.log(`Ingesta programada cada ${hours} h`);
    this.timer = setInterval(() => {
      runWithNewRequestId(() =>
        this.ingestion.runUniversities('schedule'),
      ).catch((error: unknown) => {
        this.logger.warn(`Ingesta programada omitida: ${String(error)}`);
      });
    }, hours * 3_600_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
