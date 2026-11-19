import { Controller, Get, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import type { Request } from 'express';
import { StudioService } from './studio.service';
import { AnalyticsQuery } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/auth.types';

@Controller('artists/me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('artist')
export class StudioController {
  constructor(private studio: StudioService) {}

  @Get('dashboard') dashboard(@CurrentUser() u: AuthUser) { return this.studio.dashboard(u.id); }

  @Get('analytics') analytics(@CurrentUser() u: AuthUser, @Query() q: AnalyticsQuery) { return this.studio.analytics(u.id, q.range); }

  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @Post('images')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'avatar', maxCount: 1 }, { name: 'cover', maxCount: 1 }], {
    storage: diskStorage({ destination: tmpdir(), filename: (_req, _file, cb) => cb(null, `waxo-${randomUUID()}`) }),
    limits: { fileSize: 5 * 1024 * 1024, files: 2, fields: 5 },
  }))
  images(@CurrentUser() u: AuthUser, @UploadedFiles() files: { avatar?: Express.Multer.File[]; cover?: Express.Multer.File[] }, @Req() req: Request) {
    return this.studio.updateImages(u.id, files ?? {}, req.ip);
  }
}
