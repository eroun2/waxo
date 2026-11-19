import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

@Injectable()
export class AuditService {
  private log = new Logger('Audit');
  constructor(@Inject(PG_POOL) private pool: Pool) {}

  /** Never throws: an audit failure must not break the user's request. */
  async record(actorId: string | null, action: string, entityType: string, entityId?: string,
               metadata: Record<string, unknown> = {}, ip?: string) {
    try {
      await this.pool.query(
        'INSERT INTO audit_logs(actor_id, action, entity_type, entity_id, metadata, ip) VALUES ($1,$2,$3,$4,$5,$6)',
        [actorId, action, entityType, entityId ?? null, metadata, ip ?? null],
      );
    } catch (e) {
      this.log.error(`Failed to write audit log for ${action}: ${(e as Error).message}`);
    }
  }
}
