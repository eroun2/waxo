import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEmail, IsIn, IsInt, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { PageQuery } from '../common/pagination.dto';

export class AdminArtistListQuery extends PageQuery {
  @IsOptional() @IsIn(['pending', 'active', 'rejected', 'suspended']) status: string = 'pending';
  @IsOptional() @IsString() @MaxLength(60) q?: string;
}

export class ReasonDto {
  @IsString() @Length(5, 500) reason: string;
}

export class ArtistFlagsDto {
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsBoolean() isVerified?: boolean;
  @IsOptional() @Type(() => Date) @IsDate() featuredUntil?: Date;
}

export class AdminSongListQuery extends PageQuery {
  @IsOptional() @IsIn(['all', 'pending_review', 'approved', 'scheduled', 'rejected', 'removed', 'draft', 'processing']) status: string = 'pending_review';
  @IsOptional() @IsString() @MaxLength(60) q?: string;
  @IsOptional() @IsIn(['oldest', 'newest', 'streams']) sort?: string;
}

export class FeatureDto {
  @IsBoolean() featured: boolean;
}

export class UserListQuery extends PageQuery {
  @IsOptional() @IsIn(['active', 'suspended']) status?: string;
  @IsOptional() @IsString() @MaxLength(60) q?: string;
}
export class AuditQuery extends PageQuery {
  @IsOptional() @IsString() @MaxLength(60) action?: string;
  @IsOptional() @IsString() @MaxLength(40) entityType?: string;
}
export class CreateAdminDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @MinLength(12) @MaxLength(72) password: string;
  @Type(() => Number) @IsInt() roleId: number;
}
export class DistrictDto {
  @IsString() @Length(2, 60) name: string;
  @IsString() @Length(2, 40) region: string;
  @IsOptional() @Matches(/^[A-Z]{2}$/, { message: 'countryCode must be a 2-letter code like UG' }) countryCode?: string;
}
export class UpdateDistrictDto {
  @IsOptional() @IsString() @Length(2, 60) name?: string;
  @IsOptional() @IsString() @Length(2, 40) region?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class GenreDto { @IsString() @Length(2, 40) name: string; }
export class UpdateGenreDto {
  @IsOptional() @IsString() @Length(2, 40) name?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class ReportListQuery extends PageQuery {
  @IsOptional() @IsIn(['all', 'open', 'investigating', 'resolved', 'dismissed']) status: string = 'open';
}
export class NoteDto { @IsOptional() @IsString() @MaxLength(1000) note?: string; }
export class RequiredNoteDto { @IsString() @Length(5, 1000) note: string; }
