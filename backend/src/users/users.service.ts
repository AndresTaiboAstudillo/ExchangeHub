import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    // Solo perfiles visibles; nunca el hash de la contraseña ni el email.
    return this.prisma.user.findMany({
      where: { isVisible: true },
      select: {
        id: true,
        name: true,
        countryOfOrigin: true,
        universityOrigin: true,
        career: true,
        bio: true,
      },
    });
  }
}
