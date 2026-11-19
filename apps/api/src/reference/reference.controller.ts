import { Controller, Get, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

@Controller()
export class ReferenceController {
  constructor(@Inject(PG_POOL) private pool: Pool) {}

  @Get('districts')
  async districts() {
    const { rows } = await this.pool.query('SELECT id, name, slug, country_code FROM districts WHERE is_active ORDER BY name');
    return rows;
  }

  @Get('genres')
  async genres() {
    const { rows } = await this.pool.query('SELECT id, name, slug FROM genres WHERE is_active ORDER BY name');
    return rows;
  }
}
