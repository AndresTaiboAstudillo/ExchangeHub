import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PythonModule } from '../python/python.module.js';
import { AdminGuard } from './admin.guard.js';
import { IngestionScheduler } from './ingestion.scheduler.js';
import { IngestionService } from './ingestion.service.js';
import { MetricsService } from './metrics.service.js';
import { UniversitiesController } from './universities.controller.js';
import { UniversitiesService } from './universities.service.js';

@Module({
  imports: [AuthModule, PythonModule],
  controllers: [UniversitiesController],
  providers: [
    UniversitiesService,
    IngestionService,
    IngestionScheduler,
    MetricsService,
    AdminGuard,
  ],
})
export class UniversitiesModule {}
