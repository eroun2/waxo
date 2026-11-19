import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { OptionalJwtAuthGuard } from './optional-jwt.guard';
import { PermissionsGuard } from './permissions.guard';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard, PermissionsGuard, OptionalJwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard, PermissionsGuard, OptionalJwtAuthGuard],
})
export class AuthModule {}
