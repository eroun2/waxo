import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import type { Request } from 'express';
import { SongsService } from './songs.service';
import { MySongsQuery, UpdateSongDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ApprovedArtistGuard } from '../artists/approved-artist.guard';
import { CurrentArtist, CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/auth.types';

const MAX_AUDIO_BYTES = Number(process.env.MAX_AUDIO_MB ?? 150) * 1024 * 1024;
const artistOnly = [JwtAuthGuard, RolesGuard, ApprovedArtistGuard];

@Controller('songs')
export class SongsController {
  constructor(private songs: SongsService) {}

  // Guards run before multer touches the disk, so anonymous requests never write temp files.
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @UseGuards(...artistOnly) @Roles('artist') @Post()
  @UseInterceptors(FileFieldsInterceptor([{ name: 'audio', maxCount: 1 }, { name: 'artwork', maxCount: 1 }], {
    storage: diskStorage({ destination: tmpdir(), filename: (_req, _file, cb) => cb(null, `waxo-${randomUUID()}`) }),
    limits: { fileSize: MAX_AUDIO_BYTES, files: 2, fields: 20 },
  }))
  upload(@CurrentArtist() a: { id: string }, @CurrentUser() u: AuthUser, @Body() body: unknown,
         @UploadedFiles() files: { audio?: Express.Multer.File[]; artwork?: Express.Multer.File[] }, @Req() req: Request) {
    return this.songs.create(a.id, u.id, body, files ?? {}, req.ip);
  }

  // ----- artist's own songs ("mine" routes come before ":id") -----
  @UseGuards(...artistOnly) @Roles('artist') @Get('mine')
  mine(@CurrentArtist() a: { id: string }, @Query() q: MySongsQuery) { return this.songs.listMine(a.id, q); }

  @UseGuards(...artistOnly) @Roles('artist') @Get('mine/:id')
  mineOne(@CurrentArtist() a: { id: string }, @Param('id', ParseUUIDPipe) id: string) { return this.songs.getMine(a.id, id); }

  @UseGuards(...artistOnly) @Roles('artist') @Patch(':id')
  update(@CurrentArtist() a: { id: string }, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSongDto) {
    return this.songs.update(a.id, id, dto);
  }

  @UseGuards(...artistOnly) @Roles('artist') @Post(':id/retry-processing') @HttpCode(200)
  retry(@CurrentArtist() a: { id: string }, @Param('id', ParseUUIDPipe) id: string) { return this.songs.retryProcessing(a.id, id); }

  @UseGuards(...artistOnly) @Roles('artist') @Delete(':id') @HttpCode(204)
  remove(@CurrentArtist() a: { id: string }, @CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.songs.remove(a.id, u.id, id, req.ip);
  }

  // ----- public -----
  @Get(':id')
  one(@Param('id', ParseUUIDPipe) id: string) { return this.songs.getPublic(id); }

  @UseGuards(OptionalJwtAuthGuard) @Get(':id/stream-url')
  stream(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request & { user?: AuthUser }) { return this.songs.streamUrl(id, req.user); }

  @UseGuards(OptionalJwtAuthGuard) @Get(':id/download-url')
  download(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request & { user?: AuthUser }) {
    return this.songs.downloadUrl(id, req.user, req.ip);
  }
}
