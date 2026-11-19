import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class StartPlayDto {
  @IsUUID() songId: string;
  @IsOptional() @IsUUID() sessionId?: string; // random id the client keeps per browser session
}

export class HeartbeatDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(36000) seconds: number; // total seconds listened so far in this play
}
