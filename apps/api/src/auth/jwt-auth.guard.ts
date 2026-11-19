import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Pool } from 'pg';
import * as jwt from 'jsonwebtoken';
import { PG_POOL } from '../database/database.module';
import { AuthUser } from '../common/auth.types';

/** Verifies the bearer token, then re-checks the account in the DB so suspensions take effect immediately. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(PG_POOL) private pool: Pool) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers.authorization ?? '';
    if (!header.startsWith('Bearer ')) throw new UnauthorizedException();
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(header.slice(7), process.env.JWT_ACCESS_SECRET!) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedException();
    }
    const { rows } = await this.pool.query('SELECT id, role, status, admin_role_id FROM users WHERE id = $1', [payload.sub]);
    const u = rows[0];
    if (!u || u.status !== 'active') throw new UnauthorizedException();
    req.user = { id: u.id, role: u.role, adminRoleId: u.admin_role_id } satisfies AuthUser;
    return true;
  }
}
