import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isForeignKeyViolation, toPage } from '../common/pagination.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { CreateReplyDto } from './dto/create-reply.dto.js';
import { ListPostsDto } from './dto/list-posts.dto.js';

const author = { select: { id: true, name: true, countryOfOrigin: true } } as const;

const POST_NOT_FOUND = 'La publicación no existe';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreatePostDto) {
    return this.prisma.post.create({
      data: {
        authorId: userId,
        category: dto.category,
        title: dto.title,
        body: dto.body,
      },
      select: {
        id: true,
        category: true,
        title: true,
        body: true,
        likesCount: true,
        createdAt: true,
        author,
      },
    });
  }

  async list(userId: string, query: ListPostsDto) {
    const rows = await this.prisma.post.findMany({
      where: query.category ? { category: query.category } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        category: true,
        title: true,
        body: true,
        likesCount: true,
        createdAt: true,
        author,
        _count: { select: { replies: true } },
        likes: { where: { userId }, select: { id: true } },
      },
    });

    const page = toPage(rows, query.limit);
    return {
      items: page.items.map(({ _count, likes, ...post }) => ({
        ...post,
        repliesCount: _count.replies,
        likedByMe: likes.length > 0,
      })),
      nextCursor: page.nextCursor,
    };
  }

  async findOne(userId: string, id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: {
        id: true,
        category: true,
        title: true,
        body: true,
        likesCount: true,
        createdAt: true,
        author,
        likes: { where: { userId }, select: { id: true } },
        replies: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { id: true, body: true, createdAt: true, author },
        },
      },
    });
    if (!post) throw new NotFoundException(POST_NOT_FOUND);
    const { likes, ...rest } = post;
    return { ...rest, likedByMe: likes.length > 0 };
  }

  async remove(userId: string, id: string): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { authorId: true },
    });
    if (!post) throw new NotFoundException(POST_NOT_FOUND);
    if (post.authorId !== userId) {
      throw new ForbiddenException('Solo el autor puede borrar la publicación');
    }
    // Las respuestas y los likes se eliminan en cascada.
    await this.prisma.post.delete({ where: { id } });
  }

  async createReply(userId: string, postId: string, dto: CreateReplyDto) {
    try {
      return await this.prisma.postReply.create({
        data: { postId, authorId: userId, body: dto.body },
        select: { id: true, body: true, createdAt: true, author },
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) throw new NotFoundException(POST_NOT_FOUND);
      throw error;
    }
  }

  async removeReply(userId: string, postId: string, replyId: string): Promise<void> {
    const reply = await this.prisma.postReply.findFirst({
      where: { id: replyId, postId },
      select: { authorId: true },
    });
    if (!reply) throw new NotFoundException('La respuesta no existe');
    if (reply.authorId !== userId) {
      throw new ForbiddenException('Solo el autor puede borrar la respuesta');
    }
    await this.prisma.postReply.delete({ where: { id: replyId } });
  }

  /** Idempotente: darle like dos veces cuenta una sola vez. */
  like(userId: string, postId: string) {
    return this.prisma.$transaction(async (tx) => {
      const post = await tx.post.findUnique({ where: { id: postId }, select: { id: true } });
      if (!post) throw new NotFoundException(POST_NOT_FOUND);

      // skipDuplicates (ON CONFLICT DO NOTHING) evita la condición de carrera.
      const { count } = await tx.postLike.createMany({
        data: [{ postId, userId }],
        skipDuplicates: true,
      });
      const updated =
        count > 0
          ? await tx.post.update({
              where: { id: postId },
              data: { likesCount: { increment: 1 } },
              select: { likesCount: true },
            })
          : await tx.post.findUniqueOrThrow({
              where: { id: postId },
              select: { likesCount: true },
            });
      return { liked: true, likesCount: updated.likesCount };
    });
  }

  /** Idempotente: quitar un like que no existe no cambia nada. */
  unlike(userId: string, postId: string) {
    return this.prisma.$transaction(async (tx) => {
      const post = await tx.post.findUnique({ where: { id: postId }, select: { id: true } });
      if (!post) throw new NotFoundException(POST_NOT_FOUND);

      const { count } = await tx.postLike.deleteMany({ where: { postId, userId } });
      const updated =
        count > 0
          ? await tx.post.update({
              where: { id: postId },
              data: { likesCount: { decrement: 1 } },
              select: { likesCount: true },
            })
          : await tx.post.findUniqueOrThrow({
              where: { id: postId },
              select: { likesCount: true },
            });
      return { liked: false, likesCount: updated.likesCount };
    });
  }
}
