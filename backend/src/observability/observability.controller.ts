import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../universities/admin.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { httpMetrics } from './http-metrics.js';

@ApiTags('Observabilidad')
@ApiBearerAuth()
@Controller('metrics')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ObservabilityController {
  /** Tiempos de respuesta por ruta desde que arrancó el proceso. */
  @ApiOperation({
    summary: 'Tiempos de respuesta HTTP por ruta (solo administradores)',
  })
  @Get('http')
  http() {
    return httpMetrics.snapshot();
  }
}
