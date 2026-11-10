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
import type { JwtPayload } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PaginationDto } from '../common/pagination.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Notificaciones')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @ApiOperation({ summary: 'Mis notificaciones (más recientes primero)' })
  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: PaginationDto) {
    return this.notifications.list(user.sub, query.limit, query.cursor);
  }

  @ApiOperation({ summary: 'Marcar todas como leídas' })
  @Post('read-all')
  @HttpCode(200)
  readAll(@CurrentUser() user: JwtPayload) {
    return this.notifications.markAllRead(user.sub);
  }

  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  @Post(':id/read')
  @HttpCode(200)
  read(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(user.sub, id);
  }
}
