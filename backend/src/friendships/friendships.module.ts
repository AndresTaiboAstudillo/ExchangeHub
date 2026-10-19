import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FriendshipsController } from './friendships.controller.js';
import { FriendshipsService } from './friendships.service.js';

@Module({
  imports: [AuthModule],
  controllers: [FriendshipsController],
  providers: [FriendshipsService],
})
export class FriendshipsModule {}
