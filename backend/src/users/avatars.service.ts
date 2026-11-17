import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export const AVATAR_MAX_BYTES = 64 * 1024;

type AvatarType = 'image/jpeg' | 'image/png' | 'image/webp';

/** El tipo se deduce de los primeros bytes: lo que declare el cliente no se usa. */
export function sniffImageType(data: Buffer): AvatarType | null {
  if (
    data.length >= 3 &&
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    data.length >= 8 &&
    data
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString('latin1') === 'RIFF' &&
    data.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

@Injectable()
export class AvatarsService {
  constructor(private readonly prisma: PrismaService) {}

  async save(userId: string, image: string): Promise<void> {
    const data = Buffer.from(image.slice(image.indexOf(',') + 1), 'base64');
    if (data.length > AVATAR_MAX_BYTES) {
      throw new BadRequestException('La imagen pesa demasiado (máximo 64 KB)');
    }
    const contentType = sniffImageType(data);
    if (!contentType) {
      throw new BadRequestException('El archivo no es una imagen válida');
    }
    await this.prisma.$transaction([
      this.prisma.userAvatar.upsert({
        where: { userId },
        create: { userId, contentType, data },
        update: { contentType, data },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { avatarUpdatedAt: new Date() },
      }),
    ]);
  }

  async remove(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.userAvatar.deleteMany({ where: { userId } }),
      this.prisma.user.update({
        where: { id: userId },
        data: { avatarUpdatedAt: null },
      }),
    ]);
  }

  async get(userId: string) {
    const avatar = await this.prisma.userAvatar.findUnique({
      where: { userId },
      select: { contentType: true, data: true },
    });
    if (!avatar) throw new NotFoundException('Sin foto de perfil');
    return avatar;
  }
}
