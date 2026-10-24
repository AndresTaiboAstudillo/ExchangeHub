import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  PipelineResult,
  PipelineSource,
} from '../universities/pipeline.types.js';

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  timeoutMs: number;
}

@Injectable()
export class PythonService {
  private readonly logger = new Logger(PythonService.name);
  private readonly baseUrl = (
    process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8001'
  ).replace(/\/$/, '');
  /** Llamadas rápidas (health, info). */
  private readonly timeoutMs = Number(
    process.env.PYTHON_SERVICE_TIMEOUT_MS ?? 3000,
  );
  /** El pipeline descarga y procesa fuentes externas: necesita bastante más tiempo. */
  private readonly pipelineTimeoutMs = Number(
    process.env.PYTHON_PIPELINE_TIMEOUT_MS ?? 120000,
  );

  health(): Promise<{ status: string }> {
    return this.request('/health', { timeoutMs: this.timeoutMs });
  }

  info(): Promise<{ message: string }> {
    return this.request('/', { timeoutMs: this.timeoutMs });
  }

  runUniversitiesPipeline(sources: PipelineSource[]): Promise<PipelineResult> {
    return this.request('/v1/pipeline/universities/run', {
      method: 'POST',
      body: { sources },
      timeoutMs: this.pipelineTimeoutMs,
    });
  }

  private async request<T>(path: string, options: RequestOptions): Promise<T> {
    const { method = 'GET', body, timeoutMs } = options;
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers:
          body === undefined
            ? undefined
            : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      this.logger.error(`Fallo al llamar a Python (${path}): ${String(error)}`);
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new GatewayTimeoutException(
          'El servicio Python no respondió a tiempo',
        );
      }
      throw new ServiceUnavailableException(
        'No se pudo contactar al servicio Python',
      );
    }
    if (!response.ok) {
      this.logger.error(`Python respondió ${response.status} en ${path}`);
      throw new BadGatewayException(
        `El servicio Python respondió con ${response.status}`,
      );
    }
    try {
      return (await response.json()) as T;
    } catch {
      this.logger.error(`Python devolvió una respuesta no JSON en ${path}`);
      throw new BadGatewayException(
        'El servicio Python devolvió una respuesta inválida',
      );
    }
  }
}
