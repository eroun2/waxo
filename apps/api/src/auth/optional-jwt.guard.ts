import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import * as jwt from 'jsonwebtoken';
import { PG_POOL } from '../database/database.module';

/** For public routes that behave differently for logged-in users. Never rejects; just sets req.user if the token is valid. */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(@Inject(PG_POOL) private pool: Pool) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const h: string = req.headers.authorization ?? '';
    if (!h.startsWith('Bearer ')) return true;
    try {
      const p = jwt.verify(h.slice(7), process.env.JWT_ACCESS_SECRET!) as jwt.JwtPayload;
      const { rows } = await this.pool.query('SELECT id, role, status, admin_role_id FROM users WHERE id = $1', [p.sub]);
      if (rows[0]?.status === 'active') req.user = { id: rows[0].id, role: rows[0].role, adminRoleId: rows[0].admin_role_id };
    } catch { /* anonymous */ }
    return true;
  }
}
