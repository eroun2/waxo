import { IsIn } from 'class-validator';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsObject, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { PageQuery } from '../common/pagination.dto';

export class UpdateArtistDto {
  @IsOptional() @IsString() @Length(2, 60) stageName?: string;
  @IsOptional() @Matches(/^\+?[0-9 ()-]{7,20}$/, { message: 'phone must be a valid phone number' }) phone?: string;
  @IsOptional() @IsInt() districtId?: number;
  @IsOptional() @IsString() @MaxLength(100) town?: string;
  @IsOptional() @IsString() @MaxLength(2000) bio?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(5) @IsInt({ each: true }) genreIds?: number[];
  @IsOptional() @IsObject() socialLinks?: Record<string, string>;
}

export class ArtistListQuery extends PageQuery {
  @IsOptional() @IsString() @MaxLength(60) q?: string;
  @IsOptional() @IsString() @MaxLength(60) district?: string; // district slug
  @IsOptional() @IsString() @MaxLength(60) genre?: string;    // genre slug
}

export class AnalyticsQuery {
  @IsOptional() @IsIn(['30d', '90d', '12m']) range: '30d' | '90d' | '12m' = '30d';
}
