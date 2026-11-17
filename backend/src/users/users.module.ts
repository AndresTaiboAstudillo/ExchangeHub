import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AvatarsController } from './avatars.controller.js';
import { AvatarsService } from './avatars.service.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [AuthModule],
  providers: [UsersService, AvatarsService],
  controllers: [UsersController, AvatarsController],
})
export class UsersModule {}
