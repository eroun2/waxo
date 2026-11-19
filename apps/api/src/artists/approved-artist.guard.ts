import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

/**
 * Use after JwtAuthGuard on artist-only write routes (uploads, albums...).
 * Attaches req.artist = { id } and blocks artists whose profile is not approved.
 */
@Injectable()
export class ApprovedArtistGuard implements CanActivate {
  constructor(@Inject(PG_POOL) private pool: Pool) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    if (req.user?.role !== 'artist') throw new ForbiddenException();
    const { rows } = await this.pool.query('SELECT id, approval_status FROM artist_profiles WHERE user_id = $1', [req.user.id]);
    if (!rows[0] || rows[0].approval_status !== 'active') {
      throw new ForbiddenException({ code: 'ARTIST_NOT_APPROVED', message: 'Your artist profile has not been approved yet.' });
    }
    req.artist = { id: rows[0].id };
    return true;
  }
}
