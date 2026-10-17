import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PythonModule } from './python/python.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, PythonModule, HealthModule],
})
export class AppModule {}
