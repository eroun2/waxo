import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';

export const PG_POOL = 'PG_POOL';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: () => {
        const cs = process.env.DATABASE_URL || '';
        const isCloud = cs.includes('supabase.com') || cs.includes('sslmode=require');
        return new Pool({
          connectionString: cs,
          ssl: isCloud ? { rejectUnauthorized: false } : undefined,
        });
      },
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule {}
