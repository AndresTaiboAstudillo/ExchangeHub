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
  Query,
  UseGuards,
} from '@nestjs/common';
import type { JwtPayload } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateFriendshipDto } from './dto/create-friendship.dto.js';
import { ListFriendshipsDto } from './dto/list-friendships.dto.js';
import { RespondFriendshipDto } from './dto/respond-friendship.dto.js';
import { FriendshipsService } from './friendships.service.js';

@Controller('friendships')
@UseGuards(JwtAuthGuard)
export class FriendshipsController {
  constructor(private readonly friendshipsService: FriendshipsService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateFriendshipDto) {
    return this.friendshipsService.create(user.sub, dto.addresseeId);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListFriendshipsDto) {
    return this.friendshipsService.list(user.sub, query);
  }

  @Patch(':id')
  respond(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondFriendshipDto,
  ) {
    return this.friendshipsService.respond(user.sub, id, dto.status);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.friendshipsService.remove(user.sub, id);
  }
}
