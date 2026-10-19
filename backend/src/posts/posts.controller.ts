import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { JwtPayload } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { CreateReplyDto } from './dto/create-reply.dto.js';
import { ListPostsDto } from './dto/list-posts.dto.js';
import { PostsService } from './posts.service.js';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePostDto) {
    return this.postsService.create(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListPostsDto) {
    return this.postsService.list(user.sub, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.postsService.findOne(user.sub, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.postsService.remove(user.sub, id);
  }

  @Post(':id/replies')
  createReply(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReplyDto,
  ) {
    return this.postsService.createReply(user.sub, id, dto);
  }

  @Delete(':id/replies/:replyId')
  @HttpCode(204)
  removeReply(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('replyId', ParseUUIDPipe) replyId: string,
  ) {
    return this.postsService.removeReply(user.sub, id, replyId);
  }

  @Put(':id/like')
  @HttpCode(200)
  like(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.postsService.like(user.sub, id);
  }

  @Delete(':id/like')
  @HttpCode(200)
  unlike(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.postsService.unlike(user.sub, id);
  }
}
