import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminGuard } from '../universities/admin.guard.js';
import { ObservabilityController } from './observability.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [ObservabilityController],
  providers: [AdminGuard],
})
export class ObservabilityModule {}
