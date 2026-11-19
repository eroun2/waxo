import { Module } from '@nestjs/common';
import { AdminArtistsController } from './admin-artists.controller';
import { AdminArtistsService } from './admin-artists.service';
import { AdminSongsController } from './admin-songs.controller';
import { AdminSongsService } from './admin-songs.service';
import { AdminMoreController } from './admin-more.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminUsersService } from './admin-users.service';
import { AdminReferenceService } from './admin-reference.service';
import { AdminReportsService } from './admin-reports.service';

@Module({
  controllers: [AdminArtistsController, AdminSongsController, AdminMoreController],
  providers: [AdminArtistsService, AdminSongsService, AdminDashboardService, AdminUsersService, AdminReferenceService, AdminReportsService],
})
export class AdminModule {}
