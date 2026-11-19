import { ArrayMaxSize, Equals, IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';

export const REPORT_REASONS = ['inappropriate', 'hate_or_abuse', 'spam', 'misleading', 'other'] as const;

export class MusicReportDto {
  @IsUUID() songId: string;
  @IsIn(REPORT_REASONS) reason: string;
  @IsOptional() @IsString() @MaxLength(1000) details?: string;
}

export class CopyrightReportDto {
  @IsUUID() songId: string;
  @IsString() @Length(2, 100) reporterName: string;
  @IsEmail() @MaxLength(254) reporterEmail: string;
  @IsString() @Length(20, 3000) claimDetails: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @Matches(/^https:\/\/\S{4,500}$/, { each: true, message: 'Each evidence link must be a valid https URL' }) evidenceUrls?: string[];
  @IsBoolean() @Equals(true, { message: 'You must confirm the statement to submit a complaint' }) goodFaithStatement: boolean;
}
