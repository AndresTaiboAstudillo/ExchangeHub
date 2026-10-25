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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from './admin.guard.js';
import { ListUniversitiesDto } from './dto/list-universities.dto.js';
import { ResolveUniversityDto } from './dto/resolve-university.dto.js';
import { IngestionService } from './ingestion.service.js';
import { MetricsService } from './metrics.service.js';
import { UniversitiesService } from './universities.service.js';

@ApiTags('Universidades')
@ApiBearerAuth()
@Controller('universities')
@UseGuards(JwtAuthGuard)
export class UniversitiesController {
  constructor(
    private readonly universities: UniversitiesService,
    private readonly ingestion: IngestionService,
    private readonly metrics: MetricsService,
  ) {}

  /** Lista o busca instituciones. Con `q`, ordena por relevancia (BM25). */
  @ApiOperation({
    summary: 'Buscar instituciones (búsqueda BM25 con filtros) o listarlas',
  })
  @Get()
  list(@Query() query: ListUniversitiesDto) {
    return this.universities.list(query);
  }

  /** Vincula un nombre escrito a mano con el catálogo (sin adivinar: ante la duda, candidatos). */
  @ApiOperation({
    summary: 'Resolver el nombre de una universidad escrito por el usuario',
  })
  @Get('resolve')
  resolve(@Query() query: ResolveUniversityDto) {
    return this.universities.resolve(query.name);
  }

  /** Cuándo se recuperó cada fuente por última vez y si está desactualizada. */
  @ApiOperation({ summary: 'Frescura y procedencia de las fuentes de datos' })
  @Get('sources')
  sources() {
    return this.universities.sourcesStatus();
  }

  /** Calidad de los datos y de la recuperación: % válidos, % duplicados, cobertura, tiempos, errores. */
  @ApiOperation({
    summary: 'Métricas de calidad de los datos y de la recuperación',
  })
  @Get('metrics')
  getMetrics() {
    return this.metrics.metrics();
  }

  @ApiOperation({ summary: 'Historial de ingestas (solo administradores)' })
  @Get('ingestion-runs')
  @UseGuards(AdminGuard)
  runs() {
    return this.ingestion.listRuns();
  }

  /**
   * Dispara la recuperación de datos. Responde 200 con el resultado incluso si falla
   * (`status: "failed"`): en ese caso se conservan los datos anteriores.
   */
  @ApiOperation({
    summary: 'Ejecutar la ingesta desde las fuentes web (solo administradores)',
  })
  @Post('ingestion')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  run(@CurrentUser() user: JwtPayload) {
    return this.ingestion.runUniversities(`user:${user.sub}`);
  }

  @ApiOperation({ summary: 'Ficha de una institución con su procedencia' })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.universities.findOne(id);
  }
}
