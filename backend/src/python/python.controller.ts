import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PythonService } from './python.service.js';

@ApiTags('Servicio Python')
@ApiBearerAuth()
@Controller('python')
@UseGuards(JwtAuthGuard)
export class PythonController {
  constructor(private readonly pythonService: PythonService) {}

  // El frontend nunca llama a Python directamente: pasa siempre por aquí.
  @ApiOperation({ summary: 'Estado del servicio Python' })
  @Get('status')
  async status() {
    const [health, info] = await Promise.all([
      this.pythonService.health(),
      this.pythonService.info(),
    ]);
    return { service: 'python', ...health, message: info.message };
  }
}
