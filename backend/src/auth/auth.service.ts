import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

const BCRYPT_ROUNDS = 10;

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
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    try {
      return await this.prisma.user.create({
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
}
