import { Module } from '@nestjs/common';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';
import { AudioProcessor } from './audio.processor';
import { ArtistsModule } from '../artists/artists.module';

@Module({
  imports: [ArtistsModule],
  controllers: [SongsController],
  providers: [SongsService, AudioProcessor],
})
export class SongsModule {}
