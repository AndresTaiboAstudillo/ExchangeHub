import { createHmac, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Logger,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { allowedOrigins } from '../app.setup.js';
import { MailService, maskEmail } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

const BCRYPT_ROUNDS = 10;

/** Vigencia del enlace de recuperación. */
export const RESET_TOKEN_TTL_MINUTES = 30;

const INVALID_RESET_LINK = 'El enlace no es válido o ya venció. Pide uno nuevo.';

/**
 * De cada token solo se guarda esta huella: leer la base no permite usar enlaces pendientes. El token
 * son 256 bits aleatorios (no una contraseña elegida por una persona), por eso basta un HMAC rápido;
 * la clave del servidor impide además verificar candidatos con solo un volcado de la base.
 */
export const hashResetToken = (token: string) =>
  createHmac('sha256', process.env.JWT_SECRET ?? '')
    .update(token)
    .digest('hex');

/** Dirección base del frontend para armar el enlace del correo. */
function frontendBaseUrl(): string {
  const configured = process.env.FRONTEND_URL?.trim() || allowedOrigins()[0];
  return (configured ?? 'http://localhost:3000').replace(/\/+$/, '');
}

// Se compara contra este hash cuando el usuario no existe, para que el
// tiempo de respuesta no revele si un email está registrado.
const DUMMY_HASH = bcrypt.hashSync('contraseña-inexistente', BCRYPT_ROUNDS);

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly realtime: RealtimeService,
  ) {}

  private readonly logger = new Logger(AuthService.name);

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    let user;
    try {
      user = await this.prisma.user.create({
        // El rol nunca viene del cliente: se asigna el valor por defecto.
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          universityOrigin: dto.universityOrigin || undefined,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('El email ya está registrado');
      }
      throw error;
    }

    // No se espera el envío y cualquier fallo (incluso uno síncrono) solo se registra:
    // un SMTP lento o caído no debe afectar el registro.
    const registered = user;
    void Promise.resolve()
      .then(() =>
        this.mail.sendWelcome(registered, `${frontendBaseUrl()}/login`),
      )
      .catch((error: unknown) => {
        this.logger.error(
          `No se pudo enviar el correo de bienvenida a ${maskEmail(registered.email)}: ${
            error instanceof Error ? error.message : 'error desconocido'
          }`,
        );
      });

    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const passwordOk = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    if (!user || !passwordOk) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
    });
    return { accessToken };
  }

  /**
   * Pide un enlace de recuperación. La respuesta es la misma exista o no la cuenta (no revela qué
   * correos están registrados) y no espera al envío del correo, para que tampoco lo delate el tiempo.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, name: true, email: true },
    });
    if (user) {
      const token = randomBytes(32).toString('base64url');
      await this.prisma.$transaction([
        // Un solo enlace vigente por persona: pedir otro anula el anterior.
        this.prisma.passwordResetToken.deleteMany({
          where: { userId: user.id },
        }),
        this.prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: hashResetToken(token),
            expiresAt: new Date(
              Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000,
            ),
          },
        }),
      ]);
      const link = `${frontendBaseUrl()}/restablecer?token=${token}`;
      void this.mail
        .sendPasswordReset(user, link, RESET_TOKEN_TTL_MINUTES)
        .catch((error: unknown) => {
          // Nunca se registra el enlace en un fallo: solo quién y por qué.
          this.logger.error(
            `No se pudo enviar el correo de recuperación a ${maskEmail(user.email)}: ${
              error instanceof Error ? error.message : 'error desconocido'
            }`,
          );
        });
    }
    return { ok: true };
  }

  /** Cambia la contraseña con un enlace válido: el token se consume y las sesiones anteriores se cierran. */
  async resetPassword(dto: ResetPasswordDto): Promise<{ ok: true }> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.$transaction(async (tx) => {
      const record = await tx.passwordResetToken.findUnique({
        where: { tokenHash: hashResetToken(dto.token) },
        select: { userId: true },
      });
      if (!record) throw new BadRequestException(INVALID_RESET_LINK);
      // Consumir con una condición en la misma sentencia evita que dos usos simultáneos pasen ambos.
      const consumed = await tx.passwordResetToken.deleteMany({
        where: {
          tokenHash: hashResetToken(dto.token),
          expiresAt: { gt: new Date() },
        },
      });
      if (consumed.count !== 1) throw new BadRequestException(INVALID_RESET_LINK);
      await tx.passwordResetToken.deleteMany({
        where: { userId: record.userId },
      });
      return tx.user.update({
        where: { id: record.userId },
        data: { passwordHash, passwordChangedAt: new Date() },
        select: { id: true, name: true, email: true },
      });
    });
    this.realtime.disconnectUser(user.id);
    void this.mail.sendPasswordChanged(user).catch((error: unknown) => {
      this.logger.error(
        `No se pudo avisar del cambio de contraseña a ${maskEmail(user.email)}: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
    });
    return { ok: true };
  }
}
