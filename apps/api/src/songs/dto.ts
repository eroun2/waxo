import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, Equals, IsArray, IsBoolean, IsDate, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, MaxLength,
} from 'class-validator';
import { PageQuery } from '../common/pagination.dto';

const toBool = ({ value }: { value: unknown }) => value === true || value === 'true';
const toArray = ({ value }: { value: unknown }) => (value == null || value === '' ? undefined : Array.isArray(value) ? value : [value]);

/** Fields arrive as multipart strings, hence the transforms. */
export class CreateSongDto {
  @IsString() @Length(1, 120) title: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @Type(() => Number) @IsInt() genreId: number;
  @IsOptional() @Type(() => Number) @IsInt() districtId?: number;
  @IsOptional() @Transform(toBool) @IsBoolean() downloadsEnabled?: boolean;
  @IsOptional() @Type(() => Date) @IsDate() releaseAt?: Date;
  @IsOptional() @Transform(toArray) @IsArray() @ArrayMaxSize(5) @IsUUID('all', { each: true }) featuredArtistIds?: string[];
  @Transform(toBool) @Equals(true, { message: 'You must confirm you own or have permission to distribute this music' })
  confirmOwnership: boolean;
}

export class UpdateSongDto {
  @IsOptional() @IsString() @Length(1, 120) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsInt() genreId?: number;
  @IsOptional() @IsInt() districtId?: number;
  @IsOptional() @IsBoolean() downloadsEnabled?: boolean;
  @IsOptional() @Type(() => Date) @IsDate() releaseAt?: Date;
}

export class MySongsQuery extends PageQuery {
  @IsOptional() @IsIn(['draft', 'processing', 'pending_review', 'approved', 'scheduled', 'rejected']) status?: string;
}
