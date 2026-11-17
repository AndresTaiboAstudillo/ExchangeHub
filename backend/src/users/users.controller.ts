import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UploadAvatarDto } from './dto/upload-avatar.dto.js';
import { AvatarsService } from './avatars.service.js';
import { UsersService } from './users.service.js';

@ApiTags('Usuarios')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly avatars: AvatarsService,
  ) {}

  @ApiOperation({ summary: 'Listar usuarios visibles' })
  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.usersService.findAll(user.sub);
  }

  // Debe ir antes de ":id" para que "me" no se interprete como un id.
  @ApiOperation({ summary: 'Mi perfil' })
  @Get('me')
  getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.getMe(user.sub);
  }

  @ApiOperation({ summary: 'Actualizar mi perfil' })
  @Patch('me')
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMe(user.sub, dto);
  }

  @ApiOperation({ summary: 'Cambiar mi foto de perfil' })
  @Put('me/avatar')
  async setAvatar(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UploadAvatarDto,
  ) {
    await this.avatars.save(user.sub, dto.image);
    return this.usersService.getMe(user.sub);
  }

  @ApiOperation({ summary: 'Quitar mi foto de perfil' })
  @Delete('me/avatar')
  async removeAvatar(@CurrentUser() user: JwtPayload) {
    await this.avatars.remove(user.sub);
    return this.usersService.getMe(user.sub);
  }

  @ApiOperation({ summary: 'Ver el perfil de un usuario' })
  @Get(':id')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.findPublic(id, user.sub);
  }
}
