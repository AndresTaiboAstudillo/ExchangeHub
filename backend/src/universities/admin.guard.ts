import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Solo administradores. Va después de JwtAuthGuard; el rol se lee de la base, no del token. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.sub;
    const user = userId
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        })
      : null;
    if (user?.role !== 'admin') {
      throw new ForbiddenException('Requiere rol de administrador');
    }
    return true;
  }
}
