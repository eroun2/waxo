import {
  BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { PG_POOL } from '../database/database.module';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  GoogleAuthDto,
  LoginDto,
  RegisterArtistDto,
  RegisterListenerDto,
  ResetPasswordDto,
} from './dto';

const BCRYPT_COST = 12;
const VERIFY_TTL_HOURS = 24;
const DUMMY_HASH = bcrypt.hashSync('waxo-dummy-password', BCRYPT_COST); // equalises login timing for unknown emails
const SOCIAL_KEYS = ['facebook', 'instagram', 'twitter', 'youtube', 'tiktok', 'website'];

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const newToken = (bytes: number) => randomBytes(bytes).toString('hex');
const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'artist';

export interface ClientCtx { ip?: string; userAgent?: string }
export interface Session { accessToken: string; refreshToken: string; refreshExpiresAt: Date }

@Injectable()
export class AuthService {
  constructor(
    @Inject(PG_POOL) private pool: Pool,
    private mail: MailService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  // ---------- registration ----------
  async registerListener(dto: RegisterListenerDto, ctx: ClientCtx) {
    const hash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const { userId, token } = await this.tx(async (db) => {
      const userId = await this.insertUser(db, dto.email, hash, 'listener');
      try {
        await db.query('INSERT INTO listener_profiles(user_id, display_name, district_id) VALUES ($1,$2,$3)',
          [userId, dto.displayName.trim(), dto.districtId ?? null]);
      } catch (e) { this.rethrowFk(e); }
      return { userId, token: await this.createVerificationToken(db, userId) };
    });
    await this.mail.sendVerification(dto.email, token);
    await this.audit.record(userId, 'auth.register', 'user', userId, { role: 'listener' }, ctx.ip);
    return { message: 'Account created. Check your email to verify your address.' };
  }

  async registerArtist(dto: RegisterArtistDto, ctx: ClientCtx) {
    const hash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const { userId, token } = await this.tx(async (db) => {
      const userId = await this.insertUser(db, dto.email, hash, 'artist');
      try {
        const slug = await this.uniqueArtistSlug(db, dto.stageName);
        const { rows } = await db.query(
          `INSERT INTO artist_profiles(user_id, stage_name, slug, real_name, phone, district_id, town, bio,
             social_links, copyright_confirmed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now()) RETURNING id`,
          [userId, dto.stageName.trim(), slug, dto.realName.trim(), dto.phone.trim(), dto.districtId,
           dto.town?.trim() || null, dto.bio?.trim() || null, this.cleanSocials(dto.socialLinks)],
        );
        for (const gid of new Set(dto.genreIds)) {
          await db.query('INSERT INTO artist_genres(artist_id, genre_id) VALUES ($1,$2)', [rows[0].id, gid]);
        }
      } catch (e) { this.rethrowFk(e); }
      return { userId, token: await this.createVerificationToken(db, userId) };
    });
    await this.mail.sendVerification(dto.email, token);
    await this.audit.record(userId, 'auth.register', 'user', userId, { role: 'artist' }, ctx.ip);
    await this.notifications.notifyStaff(this.pool, 'staff.artist_pending', 'New artist awaiting approval', `${dto.stageName.trim()} registered as an artist.`, { userId })
      .catch(() => undefined);
    return { message: 'Artist account created. Verify your email; an administrator will then review your profile.' };
  }

  // ---------- email verification ----------
  async verifyEmail(codeOrToken: string, email?: string) {
    const code = (codeOrToken || '').trim();
    if (!code) throw new BadRequestException('Please provide your verification code.');
    const ok = await this.tx(async (db) => {
      const { rows } = await db.query(
        `UPDATE email_verifications SET used_at = now()
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING user_id`,
        [sha256(code)],
      );
      if (!rows.length) return false;
      await db.query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [rows[0].user_id]);
      return true;
    });
    if (!ok) throw new BadRequestException('Invalid or expired verification code. Please check your email or request a new code.');
    return { message: 'Email verified successfully. You can now log in.' };
  }

  /** Always returns the same response so it cannot be used to discover registered emails. */
  async resendVerification(email: string) {
    const { rows } = await this.pool.query('SELECT id FROM users WHERE email = $1 AND email_verified_at IS NULL', [email]);
    if (rows.length) {
      const code = await this.createVerificationToken(this.pool, rows[0].id);
      await this.mail.sendVerification(email, code);
    }
    return { message: 'If that account exists and is unverified, a new verification code has been sent.' };
  }

  // ---------- password recovery & security ----------

  /**
   * Request a password reset link.
   * Uniform response returned to prevent user enumeration attacks.
   * Rate limited to at most 3 requests per hour per account.
   */
  async forgotPassword(dto: ForgotPasswordDto, ctx: ClientCtx) {
    const email = dto.email.trim();
    const { rows } = await this.pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (rows.length) {
      const userId = rows[0].id;
      // Check rate limit: at most 3 requests per hour
      const countRes = await this.pool.query(
        `SELECT COUNT(*) FROM password_resets WHERE user_id = $1 AND created_at > now() - interval '1 hour'`,
        [userId],
      );
      const recentCount = Number(countRes.rows[0].count) || 0;

      if (recentCount < 3) {
        const token = newToken(32);
        await this.pool.query(
          `INSERT INTO password_resets(user_id, token_hash, ip, expires_at)
           VALUES ($1, $2, $3, now() + interval '1 hour')`,
          [userId, sha256(token), ctx.ip ?? null],
        );
        await this.mail.sendPasswordReset(email, token);
        await this.audit.record(userId, 'auth.forgot_password', 'user', userId, {}, ctx.ip);
      }
    }
    return { message: 'If that email is registered, we have sent a password reset link.' };
  }

  /**
   * Reset password with valid single-use token.
   * Signs the user out everywhere, marks email verified, and notifies via email.
   */
  async resetPassword(dto: ResetPasswordDto, ctx: ClientCtx) {
    const tokenHash = sha256(dto.token);
    const { rows } = await this.pool.query(
      `SELECT pr.id, pr.user_id, u.email
       FROM password_resets pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.token_hash = $1 AND pr.used_at IS NULL AND pr.expires_at > now()`,
      [tokenHash],
    );

    if (!rows.length) {
      throw new BadRequestException('This password reset link is invalid or has expired.');
    }

    const { id: resetId, user_id: userId, email } = rows[0];
    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_COST);

    await this.tx(async (db) => {
      // Mark reset token used
      await db.query('UPDATE password_resets SET used_at = now() WHERE id = $1', [resetId]);
      // Update password and prove email verification
      await db.query(
        `UPDATE users
         SET password_hash = $1, email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
         WHERE id = $2`,
        [newHash, userId],
      );
      // Invalidate all active sessions across all devices
      await db.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [
        userId,
      ]);
    });

    await this.mail.sendPasswordChanged(email);
    await this.audit.record(userId, 'auth.password_reset', 'user', userId, {}, ctx.ip);

    return { message: 'Your password has been reset successfully. Please log in with your new password.' };
  }

  /**
   * Authenticated user change password.
   * Requires current password verification, signs out other devices, retains current session.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    currentRefreshToken: string | undefined,
    ctx: ClientCtx,
  ) {
    const { rows } = await this.pool.query('SELECT password_hash, email FROM users WHERE id = $1', [userId]);
    const user = rows[0];
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(dto.currentPassword, user.password_hash);
    if (!valid) {
      throw new BadRequestException('Current password is incorrect.');
    }

    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_COST);
    await this.pool.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [
      newHash,
      userId,
    ]);

    // Revoke all other refresh tokens, keeping this device alive if present
    if (currentRefreshToken) {
      await this.pool.query(
        'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND token_hash != $2 AND revoked_at IS NULL',
        [userId, sha256(currentRefreshToken)],
      );
    } else {
      await this.pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [
        userId,
      ]);
    }

    await this.mail.sendPasswordChanged(user.email);
    await this.audit.record(userId, 'auth.password_changed', 'user', userId, {}, ctx.ip);

    return { message: 'Password changed successfully. Other sessions have been signed out.' };
  }

  /**
   * Sign out all active sessions across all devices for this account.
   */
  async logoutAll(userId: string, ctx: ClientCtx) {
    await this.pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [
      userId,
    ]);
    await this.audit.record(userId, 'auth.logout_all', 'user', userId, {}, ctx.ip);
    return { message: 'Logged out of all devices.' };
  }

  // ---------- login / sessions ----------
  async login(dto: LoginDto, ctx: ClientCtx): Promise<Session> {
    const { rows } = await this.pool.query(
      'SELECT id, password_hash, role, status, email_verified_at FROM users WHERE email = $1', [dto.email]);
    const user = rows[0];
    const valid = await bcrypt.compare(dto.password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !valid) {
      await this.audit.record(user?.id ?? null, 'auth.login_failed', 'user', user?.id, {}, ctx.ip);
      throw new UnauthorizedException('Incorrect email or password.');
    }
    if (user.status === 'suspended' || user.status === 'rejected') {
      throw new ForbiddenException({ code: 'ACCOUNT_SUSPENDED', message: 'This account is not allowed to log in.' });
    }
    if (!user.email_verified_at) {
      throw new ForbiddenException({ code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email before logging in.' });
    }
    await this.pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
    if (user.role === 'admin' || user.role === 'moderator') {
      await this.audit.record(user.id, 'auth.login', 'user', user.id, {}, ctx.ip);
    }
    return this.issueSession(this.pool, user.id, user.role, ctx);
  }

  // ---------- Google OAuth (Sign in & Sign up) ----------

  async googleAuth(dto: GoogleAuthDto, ctx: ClientCtx): Promise<Session> {
    const gUser = await this.verifyGoogleToken(dto.credential);
    const { rows } = await this.pool.query(
      'SELECT id, email, role, status, google_id, email_verified_at FROM users WHERE google_id = $1 OR email = $2',
      [gUser.sub, gUser.email],
    );

    const user = rows[0];

    if (user) {
      if (user.status === 'suspended' || user.status === 'rejected') {
        throw new ForbiddenException({ code: 'ACCOUNT_SUSPENDED', message: 'This account is not allowed to log in.' });
      }

      // Link google_id and avatar if not present, and mark email verified since Google proved ownership
      await this.pool.query(
        `UPDATE users
         SET google_id = COALESCE(google_id, $1),
             email_verified_at = COALESCE(email_verified_at, now()),
             avatar_url = COALESCE(avatar_url, $2),
             last_login_at = now()
         WHERE id = $3`,
        [gUser.sub, gUser.picture ?? null, user.id],
      );

      await this.audit.record(user.id, 'auth.google_login', 'user', user.id, {}, ctx.ip);
      return this.issueSession(this.pool, user.id, user.role, ctx);
    }

    // New user registration via Google
    const dummyHash = await bcrypt.hash(randomBytes(32).toString('hex'), BCRYPT_COST);
    const role = dto.role === 'artist' ? 'artist' : 'listener';

    const userId = await this.tx(async (db) => {
      const uRes = await db.query(
        `INSERT INTO users(email, password_hash, role, google_id, avatar_url, email_verified_at)
         VALUES ($1, $2, $3, $4, $5, now())
         RETURNING id`,
        [gUser.email, dummyHash, role, gUser.sub, gUser.picture ?? null],
      );
      const newId = uRes.rows[0].id as string;

      if (role === 'listener') {
        await db.query(
          'INSERT INTO listener_profiles(user_id, display_name, district_id) VALUES ($1, $2, $3)',
          [newId, gUser.name.slice(0, 60), dto.districtId ?? null],
        );
      } else {
        const stageName = (dto.stageName || gUser.name).trim().slice(0, 60);
        const slug = await this.uniqueArtistSlug(db, stageName);
        await db.query(
          `INSERT INTO artist_profiles(user_id, stage_name, slug, real_name, phone, district_id, copyright_confirmed_at)
           VALUES ($1, $2, $3, $4, $5, $6, now())`,
          [newId, stageName, slug, gUser.name.trim().slice(0, 100), '+256700000000', dto.districtId || 1],
        );
      }
      return newId;
    });

    await this.audit.record(userId, 'auth.google_register', 'user', userId, { role }, ctx.ip);
    return this.issueSession(this.pool, userId, role, ctx);
  }

  private async verifyGoogleToken(credential: string): Promise<{
    sub: string;
    email: string;
    name: string;
    picture?: string;
  }> {
    // In local development / preview testing, support instant demo google token
    if (process.env.NODE_ENV !== 'production' && credential.startsWith('demo-google:')) {
      const parts = credential.split(':');
      const email = (parts[1] || 'googleuser@example.com').toLowerCase();
      const name = parts[2] || 'Google User';
      return {
        sub: 'demo-google-' + Buffer.from(email).toString('hex').slice(0, 16),
        email,
        name,
        picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      };
    }

    try {
      const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
      if (!res.ok) {
        throw new BadRequestException('Google token validation failed.');
      }
      const data: any = await res.json();
      if (!data.email || !data.sub) {
        throw new BadRequestException('Google token is missing essential profile information.');
      }

      const expectedAud = process.env.GOOGLE_CLIENT_ID?.trim();
      if (expectedAud && data.aud !== expectedAud) {
        throw new UnauthorizedException('Google token was not issued for this application.');
      }

      return {
        sub: data.sub,
        email: data.email.toLowerCase(),
        name: data.name || data.given_name || data.email.split('@')[0],
        picture: data.picture,
      };
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof UnauthorizedException) throw err;
      throw new BadRequestException('Could not verify Google credential: ' + (err.message || 'Network error'));
    }
  }

  /** Rotates the refresh token. Re-use of an already-rotated token revokes the user's whole session family. */
  async refresh(rawToken: string | undefined, ctx: ClientCtx): Promise<Session> {
    if (!rawToken) throw new UnauthorizedException();
    const { rows } = await this.pool.query(
      `SELECT rt.id, rt.user_id, rt.revoked_at, rt.expires_at, u.role, u.status
       FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = $1`, [sha256(rawToken)]);
    const row = rows[0];
    if (!row) throw new UnauthorizedException();
    if (row.revoked_at) {
      await this.pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [row.user_id]);
      await this.audit.record(row.user_id, 'auth.refresh_reuse_detected', 'user', row.user_id, {}, ctx.ip);
      throw new UnauthorizedException();
    }
    if (new Date(row.expires_at) < new Date() || row.status !== 'active') throw new UnauthorizedException();
    return this.tx(async (db) => {
      await db.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [row.id]);
      return this.issueSession(db, row.user_id, row.role, ctx);
    });
  }

  async logout(rawToken: string | undefined) {
    if (rawToken) {
      await this.pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [sha256(rawToken)]);
    }
  }

  async me(userId: string) {
    const { rows } = await this.pool.query(
      `SELECT u.id, u.email, u.role, u.email_verified_at, u.plan,
              lp.display_name, ap.stage_name, ap.slug AS artist_slug, ap.approval_status AS artist_approval,
              ap.is_verified AS artist_verified, ar.name AS admin_role, ar.permissions
       FROM users u
       LEFT JOIN admin_roles ar ON ar.id = u.admin_role_id
       LEFT JOIN listener_profiles lp ON lp.user_id = u.id
       LEFT JOIN artist_profiles ap ON ap.user_id = u.id
       WHERE u.id = $1`, [userId]);
    return rows[0];
  }

  // ---------- helpers ----------
  private async issueSession(db: Pool | PoolClient, userId: string, role: string, ctx: ClientCtx): Promise<Session> {
    const accessToken = jwt.sign({ sub: userId, role }, process.env.JWT_ACCESS_SECRET!, {
      expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as jwt.SignOptions['expiresIn'],
    });
    const refreshToken = newToken(48);
    const days = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30);
    const refreshExpiresAt = new Date(Date.now() + days * 86_400_000);
    await db.query(
      'INSERT INTO refresh_tokens(user_id, token_hash, user_agent, ip, expires_at) VALUES ($1,$2,$3,$4,$5)',
      [userId, sha256(refreshToken), ctx.userAgent?.slice(0, 300) ?? null, ctx.ip ?? null, refreshExpiresAt]);
    return { accessToken, refreshToken, refreshExpiresAt };
  }

  private async createVerificationToken(db: Pool | PoolClient, userId: string) {
    // 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await db.query('INSERT INTO email_verifications(user_id, token_hash, expires_at) VALUES ($1,$2, now() + ($3 || \' hours\')::interval)',
      [userId, sha256(code), String(VERIFY_TTL_HOURS)]);
    return code;
  }

  private async insertUser(db: PoolClient, email: string, hash: string, role: 'listener' | 'artist') {
    try {
      const { rows } = await db.query(
        'INSERT INTO users(email, password_hash, role) VALUES ($1,$2,$3) RETURNING id', [email, hash, role]);
      return rows[0].id as string;
    } catch (e: any) {
      if (e.code === '23505') throw new ConflictException('An account with this email already exists.');
      throw e;
    }
  }

  private async uniqueArtistSlug(db: PoolClient, stageName: string) {
    const base = slugify(stageName);
    let slug = base;
    while ((await db.query('SELECT 1 FROM artist_profiles WHERE slug = $1', [slug])).rowCount) {
      slug = `${base}-${randomBytes(2).toString('hex')}`;
    }
    return slug;
  }

  private cleanSocials(input?: Record<string, string>) {
    const out: Record<string, string> = {};
    for (const k of SOCIAL_KEYS) {
      const v = input?.[k];
      if (typeof v === 'string' && /^https:\/\/\S{3,300}$/.test(v)) out[k] = v;
    }
    return out;
  }

  private rethrowFk(e: any): never {
    if (e.code === '23503') throw new BadRequestException('Selected district or genre does not exist.');
    throw e;
  }

  private async tx<T>(fn: (db: PoolClient) => Promise<T>): Promise<T> {
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      const r = await fn(db);
      await db.query('COMMIT');
      return r;
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    } finally {
      db.release();
    }
  }
}
