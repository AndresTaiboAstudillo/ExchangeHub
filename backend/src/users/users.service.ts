import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

const ownProfileSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  countryOfOrigin: true,
  universityOrigin: true,
  career: true,
  bio: true,
  isVisible: true,
  createdAt: true,
  languages: { select: { languageCode: true } },
  hobbies: { select: { hobby: true } },
} as const;

// Perfil que ven los demás: sin email ni rol.
const publicProfileSelect = {
  id: true,
  name: true,
  countryOfOrigin: true,
  universityOrigin: true,
  career: true,
  bio: true,
  isVisible: true,
  createdAt: true,
  languages: ownProfileSelect.languages,
  hobbies: ownProfileSelect.hobbies,
} as const;

interface WithLists {
  languages: { languageCode: string }[];
  hobbies: { hobby: string }[];
}

// El orden lo fija la aplicación: el de la base de datos depende de su configuración regional.
const collator = new Intl.Collator('es', { sensitivity: 'base' });

function flattenLists<T extends WithLists>(user: T) {
  const { languages, hobbies, ...rest } = user;
  return {
    ...rest,
    languages: languages.map((l) => l.languageCode).sort(collator.compare),
    hobbies: hobbies.map((h) => h.hobby).sort(collator.compare),
  };
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const key = v.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(requesterId: string) {
    // Solo perfiles visibles y distintos del propio; nunca el hash ni el email.
    const users = await this.prisma.user.findMany({
      where: { isVisible: true, id: { not: requesterId } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        name: true,
        countryOfOrigin: true,
        universityOrigin: true,
        career: true,
        bio: true,
        languages: publicProfileSelect.languages,
        hobbies: publicProfileSelect.hobbies,
      },
    });
    return users.map(flattenLists);
  }

  async getMe(userId: string) {
    const [user, friendsCount] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { ...ownProfileSelect, _count: { select: { posts: true } } },
      }),
      this.prisma.friendship.count({
        where: {
          status: 'accepted',
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
      }),
    ]);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const { _count, ...profile } = flattenLists(user);
    return { ...profile, postsCount: _count.posts, friendsCount };
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const { languageCodes, hobbies, ...fields } = dto;

    await this.prisma.$transaction(async (tx) => {
      const exists = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!exists) throw new NotFoundException('Usuario no encontrado');

      if (Object.keys(fields).length > 0) {
        await tx.user.update({ where: { id: userId }, data: fields });
      }
      if (languageCodes !== undefined) {
        await tx.userLanguage.deleteMany({ where: { userId } });
        await tx.userLanguage.createMany({
          data: unique(languageCodes).map((languageCode) => ({ userId, languageCode })),
        });
      }
      if (hobbies !== undefined) {
        await tx.userHobby.deleteMany({ where: { userId } });
        await tx.userHobby.createMany({
          data: unique(hobbies).map((hobby) => ({ userId, hobby })),
        });
      }
    });

    return this.getMe(userId);
  }

  async findPublic(id: string, requesterId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: publicProfileSelect,
    });
    // Un perfil oculto solo lo ve su dueño; para los demás "no existe".
    if (!user || (!user.isVisible && user.id !== requesterId)) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return flattenLists(user);
  }
}
