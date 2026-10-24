import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../universities/admin.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { httpMetrics } from './http-metrics.js';

@Controller('metrics')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ObservabilityController {
  /** Tiempos de respuesta por ruta desde que arrancó el proceso. */
  @Get('http')
  http() {
    return httpMetrics.snapshot();
  }
}
