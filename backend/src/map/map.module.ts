import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PythonModule } from '../python/python.module.js';
import { AdminGuard } from '../universities/admin.guard.js';
import { MapController } from './map.controller.js';
import { MapService } from './map.service.js';
import { PlacesIngestionService } from './places-ingestion.service.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  imports: [AuthModule, PythonModule],
  controllers: [MapController],
  providers: [MapService, PlacesIngestionService, ReviewsService, AdminGuard],
})
export class MapModule {}
