import { Module } from '@nestjs/common';
import { PythonModule } from '../python/python.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [PythonModule],
  controllers: [HealthController],
})
export class HealthModule {}
