import { IsIn } from 'class-validator';

export class RespondFriendshipDto {
  @IsIn(['accepted', 'rejected'])
  status!: 'accepted' | 'rejected';
}
