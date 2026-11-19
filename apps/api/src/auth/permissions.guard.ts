import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { PERMS_KEY } from '../common/decorators';

/** Fine-grained admin/moderator permissions from admin_roles.permissions ('*' = everything). */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector, @Inject(PG_POOL) private pool: Pool) {}

  async canActivate(ctx: ExecutionContext) {
    const needed = this.reflector.getAllAndOverride<string[]>(PERMS_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!needed?.length) return true;
    const user = ctx.switchToHttp().getRequest().user;
    if (!user?.adminRoleId) throw new ForbiddenException();
    const { rows } = await this.pool.query('SELECT permissions FROM admin_roles WHERE id = $1', [user.adminRoleId]);
    const perms: string[] = rows[0]?.permissions ?? [];
    if (perms.includes('*') || needed.every((p) => perms.includes(p))) return true;
    throw new ForbiddenException();
  }
}
