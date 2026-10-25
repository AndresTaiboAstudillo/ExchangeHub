import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { PythonService } from '../python/python.service.js';

@ApiTags('Salud')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly python: PythonService,
  ) {}

  // Liveness: el proceso está vivo. Lo usa el healthcheck de Docker.
  @ApiOperation({ summary: 'El proceso está vivo' })
  @Get()
  live() {
    return { status: 'ok' };
  }

  // Readiness: el backend y sus dependencias responden.
  @ApiOperation({ summary: 'Comprueba PostgreSQL y el servicio Python' })
  @Get('ready')
  async ready() {
    const [db, py] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.python.health(),
    ]);
    const checks = {
      database: db.status === 'fulfilled' ? 'up' : 'down',
      python: py.status === 'fulfilled' ? 'up' : 'down',
    };
    if (checks.database === 'down' || checks.python === 'down') {
      throw new ServiceUnavailableException({ status: 'error', checks });
    }
    return { status: 'ok', checks };
  }
}
