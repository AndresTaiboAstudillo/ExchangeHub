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
import { ChatService } from './chat.service.js';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @ApiOperation({
    summary: 'Mis amigos con último mensaje, no leídos y presencia',
  })
  @Get('conversations')
  conversations(@CurrentUser() user: JwtPayload) {
    return this.chat.listConversations(user.sub);
  }

  @ApiOperation({
    summary: 'Historial con un amigo (más recientes primero, paginado)',
  })
  @Get('conversations/:friendId/messages')
  history(
    @CurrentUser() user: JwtPayload,
    @Param('friendId', ParseUUIDPipe) friendId: string,
    @Query() query: PaginationDto,
  ) {
    return this.chat.history(user.sub, friendId, query.limit, query.cursor);
  }

  @ApiOperation({ summary: 'Marcar como leídos los mensajes de un amigo' })
  @Post('conversations/:friendId/read')
  @HttpCode(200)
  read(
    @CurrentUser() user: JwtPayload,
    @Param('friendId', ParseUUIDPipe) friendId: string,
  ) {
    return this.chat.markRead(user.sub, friendId);
  }
}
