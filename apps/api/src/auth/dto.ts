import {
  ArrayMaxSize, Equals, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsObject, IsOptional,
  IsString, Length, Matches, MaxLength, MinLength,
} from 'class-validator';

// bcrypt only uses the first 72 bytes, so cap the length.
const PASSWORD = { min: 10, max: 72 };

export class RegisterListenerDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @MinLength(PASSWORD.min) @MaxLength(PASSWORD.max) password: string;
  @IsString() @Length(2, 60) displayName: string;
  @IsOptional() @IsInt() districtId?: number;
}

export class RegisterArtistDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @MinLength(PASSWORD.min) @MaxLength(PASSWORD.max) password: string;
  @IsString() @Length(2, 60) stageName: string;
  @IsString() @Length(2, 100) realName: string;
  @Matches(/^\+?[0-9 ()-]{7,20}$/, { message: 'phone must be a valid phone number' }) phone: string;
  @IsInt() districtId: number;
  @IsOptional() @IsString() @MaxLength(100) town?: string;
  @IsOptional() @IsString() @MaxLength(2000) bio?: string;
  @IsArray() @ArrayMaxSize(5) @IsInt({ each: true }) genreIds: number[];
  @IsOptional() @IsObject() socialLinks?: Record<string, string>;
  @IsBoolean() @Equals(true, { message: 'You must confirm you own or have permission to distribute your music' })
  confirmOwnership: boolean;
}

export class LoginDto {
  @IsEmail() email: string;
  @IsString() @MaxLength(PASSWORD.max) password: string;
}

export class VerifyEmailDto {
  @IsOptional() @IsString() @Length(4, 128) token?: string;
  @IsOptional() @IsString() @Length(4, 128) code?: string;
  @IsOptional() @IsEmail() email?: string;
}

export class ResendVerificationDto {
  @IsEmail() email: string;
}

export class ForgotPasswordDto {
  @IsEmail() @MaxLength(254) email: string;
}

export class ResetPasswordDto {
  @IsString() @Length(32, 128) token: string;
  @IsString() @MinLength(PASSWORD.min) @MaxLength(PASSWORD.max) newPassword: string;
}

export class ChangePasswordDto {
  @IsString() @MaxLength(PASSWORD.max) currentPassword: string;
  @IsString() @MinLength(PASSWORD.min) @MaxLength(PASSWORD.max) newPassword: string;
}

export class GoogleAuthDto {
  @IsString() credential: string;
  @IsOptional() @IsIn(['listener', 'artist']) role?: 'listener' | 'artist';
  @IsOptional() @IsInt() districtId?: number;
  @IsOptional() @IsString() @MaxLength(60) stageName?: string;
}



