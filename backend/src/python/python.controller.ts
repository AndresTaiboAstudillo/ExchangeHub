import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PythonService } from './python.service.js';

@Controller('python')
@UseGuards(JwtAuthGuard)
export class PythonController {
  constructor(private readonly pythonService: PythonService) {}

  // El frontend nunca llama a Python directamente: pasa siempre por aquí.
  @Get('status')
  async status() {
    const [health, info] = await Promise.all([
      this.pythonService.health(),
      this.pythonService.info(),
    ]);
    return { service: 'python', ...health, message: info.message };
  }
}
