import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { PageQuery } from '../common/pagination.dto';

export class DiscoverQuery extends PageQuery {
  @IsOptional() @IsString() @MaxLength(60) district?: string; // district slug
  @IsOptional() @IsString() @MaxLength(60) genre?: string;    // genre slug
}

export class SearchQuery extends DiscoverQuery {
  @IsString() @Length(2, 80) q: string;
  @IsOptional() @IsIn(['all', 'songs', 'artists']) type: string = 'all';
  @IsOptional() @Type(() => Date) @IsDate() from?: Date; // released on/after
  @IsOptional() @Type(() => Date) @IsDate() to?: Date;   // released on/before
  @IsOptional() @IsIn(['relevance', 'newest', 'popular']) sort: string = 'relevance';
}

export class ArtistDirQuery extends DiscoverQuery {
  @IsOptional() @IsString() @MaxLength(60) q?: string;
}
