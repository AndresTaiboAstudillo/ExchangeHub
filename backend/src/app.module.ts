import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { ChatModule } from './chat/chat.module.js';
import { FriendshipsModule } from './friendships/friendships.module.js';
import { HealthModule } from './health/health.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ObservabilityModule } from './observability/observability.module.js';
import { PostsModule } from './posts/posts.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { PythonModule } from './python/python.module.js';
import { UniversitiesModule } from './universities/universities.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    PostsModule,
    FriendshipsModule,
    PythonModule,
    UniversitiesModule,
    RealtimeModule,
    NotificationsModule,
    ChatModule,
    HealthModule,
    ObservabilityModule,
  ],
})
export class AppModule {}
