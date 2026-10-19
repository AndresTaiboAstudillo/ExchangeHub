import { IsIn, IsOptional } from 'class-validator';
import { FRIENDSHIP_STATUSES } from '../friendship-status.js';
import type { FriendshipStatus } from '../friendship-status.js';

export class ListFriendshipsDto {
  @IsOptional()
  @IsIn(FRIENDSHIP_STATUSES)
  status?: FriendshipStatus;
}
