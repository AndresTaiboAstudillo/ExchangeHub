import { IsUUID } from 'class-validator';

export class CreateFriendshipDto {
  @IsUUID()
  addresseeId!: string;
}
