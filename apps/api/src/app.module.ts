import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { AuditModule } from './audit/audit.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ArtistsModule } from './artists/artists.module';
import { AdminModule } from './admin/admin.module';
import { StorageModule } from './storage/storage.module';
import { MediaModule } from './media/media.module';
import { QueueModule } from './queue/queue.module';
import { SongsModule } from './songs/songs.module';
import { CacheModule } from './cache/cache.module';
import { PlaysModule } from './plays/plays.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { ReportsModule } from './reports/reports.module';
import { ReferenceController } from './reference/reference.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    AuditModule,
    MailModule,
    AuthModule,
    NotificationsModule,
    StorageModule,
    MediaModule,
    QueueModule,
    CacheModule,
    ArtistsModule,
    SongsModule,
    PlaysModule,
    DiscoveryModule,
    ReportsModule,
    AdminModule,
  ],
  controllers: [HealthController, ReferenceController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
