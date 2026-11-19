import { Module } from '@nestjs/common';
import { ArtistsController } from './artists.controller';
import { ArtistsService } from './artists.service';
import { StudioController } from './studio.controller';
import { StudioService } from './studio.service';
import { ApprovedArtistGuard } from './approved-artist.guard';

@Module({
  controllers: [StudioController, ArtistsController],
  providers: [ArtistsService, StudioService, ApprovedArtistGuard],
  exports: [ApprovedArtistGuard],
})
export class ArtistsModule {}
