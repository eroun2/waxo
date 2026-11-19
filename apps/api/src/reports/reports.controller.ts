import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { ReportsService } from './reports.service';
import { CopyrightReportDto, MusicReportDto } from './dto';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { AuthUser } from '../common/auth.types';

type Req2 = Request & { user?: AuthUser };

@Controller('reports')
@UseGuards(OptionalJwtAuthGuard)
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Throttle({ default: { limit: 10, ttl: 3_600_000 } }) @Post('music') @HttpCode(201)
  music(@Body() dto: MusicReportDto, @Req() req: Req2) { return this.reports.music(dto, req.user, req.ip); }

  @Throttle({ default: { limit: 5, ttl: 3_600_000 } }) @Post('copyright') @HttpCode(201)
  copyright(@Body() dto: CopyrightReportDto, @Req() req: Req2) { return this.reports.copyright(dto, req.user, req.ip); }
}
