import { Controller, Delete, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from '../universities/admin.guard.js';
import { AdminService } from './admin.service.js';
import { UserEmailDto } from './dto/user-email.dto.js';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @ApiOperation({
    summary:
      'Ver a quién se eliminaría y cuánto contenido tiene (administradores)',
  })
  @Get('users')
  lookup(@Query() query: UserEmailDto) {
    return this.admin.lookup(query.email);
  }

  @ApiOperation({
    summary:
      'Eliminar a un usuario por su correo, con todo lo que publicó (administradores)',
  })
  @Delete('users')
  remove(@CurrentUser() user: JwtPayload, @Query() query: UserEmailDto) {
    return this.admin.deleteByEmail(user.sub, query.email);
  }
}
