import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { RateLimit, RateLimitGuard } from './rate-limit.guard.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const FIFTEEN_MIN = 15 * 60 * 1000;

@ApiTags('Autenticación')
@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Registrar un usuario' })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @ApiOperation({ summary: 'Iniciar sesión y obtener un token JWT' })
  @Post('login')
  @HttpCode(200)
  @RateLimit(
    { name: 'login', max: 10, windowMs: FIFTEEN_MIN, by: 'ip+email' },
    { name: 'login', max: 50, windowMs: FIFTEEN_MIN, by: 'ip' },
  )
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiOperation({
    summary: 'Pedir un enlace para restablecer la contraseña',
    description:
      'Responde siempre lo mismo, exista o no el correo. Si la cuenta existe, se envía un enlace de un solo uso que vale 30 minutos.',
  })
  @Post('forgot-password')
  @HttpCode(200)
  @RateLimit(
    { name: 'forgot', max: 3, windowMs: FIFTEEN_MIN, by: 'ip+email' },
    { name: 'forgot', max: 10, windowMs: FIFTEEN_MIN, by: 'ip' },
  )
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @ApiOperation({
    summary: 'Elegir una contraseña nueva con el enlace del correo',
    description:
      'Consume el token y cierra las sesiones abiertas de la cuenta.',
  })
  @Post('reset-password')
  @HttpCode(200)
  @RateLimit({ name: 'reset', max: 10, windowMs: FIFTEEN_MIN, by: 'ip' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuario del token actual' })
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return { id: request.user?.sub, email: request.user?.email };
  }
}
