export type UserRole = 'listener' | 'artist' | 'moderator' | 'admin';

export interface AuthUser {
  id: string;
  role: UserRole;
  adminRoleId: number | null;
}
