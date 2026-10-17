import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

@Injectable()
export class PythonService {
  private readonly logger = new Logger(PythonService.name);
  private readonly baseUrl = (
    process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8001'
  ).replace(/\/$/, '');
  private readonly timeoutMs = Number(
    process.env.PYTHON_SERVICE_TIMEOUT_MS ?? 3000,
  );

  health(): Promise<{ status: string }> {
    return this.get('/health');
  }

  info(): Promise<{ message: string }> {
    return this.get('/');
  }

  private async get<T>(path: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        signal: AbortSignal.timeout(this.timeoutMs),
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
    return (await response.json()) as T;
  }
}
