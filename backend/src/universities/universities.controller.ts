import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from './admin.guard.js';
import { ListUniversitiesDto } from './dto/list-universities.dto.js';
import { ResolveUniversityDto } from './dto/resolve-university.dto.js';
import { IngestionService } from './ingestion.service.js';
import { MetricsService } from './metrics.service.js';
import { UniversitiesService } from './universities.service.js';

@Controller('universities')
@UseGuards(JwtAuthGuard)
export class UniversitiesController {
  constructor(
    private readonly universities: UniversitiesService,
    private readonly ingestion: IngestionService,
    private readonly metrics: MetricsService,
  ) {}

  /** Lista o busca instituciones. Con `q`, ordena por relevancia (BM25). */
  @Get()
  list(@Query() query: ListUniversitiesDto) {
    return this.universities.list(query);
  }

  /** Vincula un nombre escrito a mano con el catálogo (sin adivinar: ante la duda, candidatos). */
  @Get('resolve')
  resolve(@Query() query: ResolveUniversityDto) {
    return this.universities.resolve(query.name);
  }

  /** Cuándo se recuperó cada fuente por última vez y si está desactualizada. */
  @Get('sources')
  sources() {
    return this.universities.sourcesStatus();
  }

  /** Calidad de los datos y de la recuperación: % válidos, % duplicados, cobertura, tiempos, errores. */
  @Get('metrics')
  getMetrics() {
    return this.metrics.metrics();
  }

  @Get('ingestion-runs')
  @UseGuards(AdminGuard)
  runs() {
    return this.ingestion.listRuns();
  }

  /**
   * Dispara la recuperación de datos. Responde 200 con el resultado incluso si falla
   * (`status: "failed"`): en ese caso se conservan los datos anteriores.
   */
  @Post('ingestion')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  run(@CurrentUser() user: JwtPayload) {
    return this.ingestion.runUniversities(`user:${user.sub}`);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.universities.findOne(id);
  }
}
