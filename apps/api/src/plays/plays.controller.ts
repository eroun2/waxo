import { Body, Controller, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { PlaysService } from './plays.service';
import { HeartbeatDto, StartPlayDto } from './dto';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { AuthUser } from '../common/auth.types';

@Controller('plays')
export class PlaysController {
  constructor(private plays: PlaysService) {}

  /** Call when playback starts. Returns a play token; send heartbeats with it while listening. */
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @UseGuards(OptionalJwtAuthGuard) @Post() @HttpCode(201)
  start(@Body() dto: StartPlayDto, @Req() req: Request & { user?: AuthUser }) {
    return this.plays.start(dto.songId, dto.sessionId, req.user, req.ip);
  }

  /** Call every ~10s and when playback stops/ends, with total seconds listened in this play. */
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Post(':token/heartbeat') @HttpCode(200)
  heartbeat(@Param('token') token: string, @Body() dto: HeartbeatDto) {
    return this.plays.heartbeat(token, dto.seconds);
  }
}
