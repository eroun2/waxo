import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { AuthUser, UserRole } from './auth.types';

export const ROLES_KEY = 'roles';
export const PERMS_KEY = 'permissions';

/** Restrict a route to these roles (use with JwtAuthGuard + RolesGuard). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
/** Require admin-role permissions, e.g. 'music.review' (use with PermissionsGuard). */
export const RequirePermissions = (...p: string[]) => SetMetadata(PERMS_KEY, p);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser =>
  ctx.switchToHttp().getRequest().user);

/** Set by ApprovedArtistGuard: the artist profile id of the logged-in, approved artist. */
export const CurrentArtist = createParamDecorator((_: unknown, ctx: ExecutionContext): { id: string } =>
  ctx.switchToHttp().getRequest().artist);
