import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from '../universities/admin.guard.js';
import { PlacesQueryDto } from './dto/places-query.dto.js';
import { CreateListingDto, UpdateListingDto } from './dto/listing.dto.js';
import { ListReviewsDto, UpsertReviewDto } from './dto/review.dto.js';
import { MapService } from './map.service.js';
import { PlacesIngestionService } from './places-ingestion.service.js';
import { ReviewsService } from './reviews.service.js';

@ApiTags('Mapa')
@ApiBearerAuth()
@Controller('map')
@UseGuards(JwtAuthGuard)
export class MapController {
  constructor(
    private readonly map: MapService,
    private readonly ingestion: PlacesIngestionService,
    private readonly reviews: ReviewsService,
  ) {}

  @ApiOperation({ summary: 'Alojamientos publicados' })
  @Get('listings')
  listings() {
    return this.map.listListings();
  }

  @ApiOperation({ summary: 'Publicar un arriendo (solo administradores)' })
  @Post('listings')
  @UseGuards(AdminGuard)
  createListing(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateListingDto,
  ) {
    return this.map.createListing(user.sub, dto);
  }

  @ApiOperation({ summary: 'Editar un arriendo (solo administradores)' })
  @Patch('listings/:id')
  @UseGuards(AdminGuard)
  updateListing(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.map.updateListing(id, dto);
  }

  @ApiOperation({
    summary: 'Eliminar un arriendo y sus reseñas (solo administradores)',
  })
  @Delete('listings/:id')
  @HttpCode(204)
  @UseGuards(AdminGuard)
  deleteListing(@Param('id', ParseUUIDPipe) id: string) {
    return this.map.deleteListing(id);
  }

  @ApiOperation({
    summary: 'Universidades e institutos vigentes con ubicación conocida',
  })
  @Get('universities')
  universities() {
    return this.map.listUniversities();
  }

  @ApiOperation({ summary: 'Zonas con su nivel de seguridad' })
  @Get('zones')
  zones() {
    return this.map.listZones();
  }

  @ApiOperation({
    summary:
      'Comercios y servicios (OpenStreetMap), filtrables por categoría y zona visible',
  })
  @Get('places')
  places(@Query() query: PlacesQueryDto) {
    return this.map.listPlaces(query);
  }

  @ApiOperation({
    summary:
      'Actualizar los comercios desde OpenStreetMap (solo administradores)',
  })
  @Post('places/refresh')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  refresh() {
    return this.ingestion.refresh();
  }

  @ApiOperation({
    summary: 'Reseñas de un comercio, con promedio y la reseña propia',
  })
  @Get('places/:id/reviews')
  listReviews(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListReviewsDto,
  ) {
    return this.reviews.list('place', id, user.sub, query);
  }

  @ApiOperation({
    summary: 'Dejar o actualizar mi reseña de un comercio (una por persona)',
  })
  @Put('places/:id/reviews')
  upsertReview(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertReviewDto,
  ) {
    return this.reviews.upsert('place', id, user.sub, dto);
  }

  @ApiOperation({
    summary: 'Eliminar una reseña propia (o cualquiera, si eres administrador)',
  })
  @Delete('reviews/:reviewId')
  @HttpCode(204)
  removeReview(
    @CurrentUser() user: JwtPayload,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ) {
    return this.reviews.remove(reviewId, user.sub);
  }

  @ApiOperation({ summary: 'Reseñas de un alojamiento' })
  @Get('listings/:id/reviews')
  listListingReviews(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListReviewsDto,
  ) {
    return this.reviews.list('listing', id, user.sub, query);
  }

  @ApiOperation({ summary: 'Dejar o actualizar mi reseña de un alojamiento' })
  @Put('listings/:id/reviews')
  upsertListingReview(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertReviewDto,
  ) {
    return this.reviews.upsert('listing', id, user.sub, dto);
  }
}
