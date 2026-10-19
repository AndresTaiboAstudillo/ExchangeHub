export const FRIENDSHIP_STATUSES = ['pending', 'accepted', 'rejected'] as const;
export type FriendshipStatus = (typeof FRIENDSHIP_STATUSES)[number];
