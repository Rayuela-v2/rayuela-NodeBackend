import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from './users/user.schema';
import { UserService } from './users/user.service';
import * as bcrypt from 'bcryptjs';
import { User } from './users/user.entity';
import { RegisterUserDTO } from './auth.controller';
import { v4 as uuidv4 } from 'uuid';
import * as nodemailer from 'nodemailer';
import * as process from 'node:process';
import { createHash, timingSafeEqual } from 'node:crypto';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  MAX_REFRESH_SESSIONS,
  REFRESH_TOKEN_SEPARATOR,
  REFRESH_TOKEN_TTL_DAYS,
} from './auth.constants';

/** Sliding expiry: TTL counted from now, refreshed on every use. */
function refreshExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export interface UserJWT {
  userId: string;
  username: string;
  role: UserRole;
}

/**
 * SHA-256 of a refresh token, hex-encoded.
 *
 * We deliberately use SHA-256 (not bcrypt) for refresh-token storage:
 *   - The token already carries 122 bits of UUID v4 entropy, so a slow KDF
 *     adds no meaningful protection — brute-forcing it from the hash is
 *     computationally infeasible regardless of speed.
 *   - bcrypt silently truncates input to 72 bytes. Since the token is shaped
 *     as `${userId}.${uuid}`, a longer userId could one day cross that limit
 *     and cause silent collisions. SHA-256 has no such cap.
 *   - Hash comparison becomes a constant-time string compare, simplifying
 *     `refreshAccessToken`.
 *
 * Standard recommendation for refresh-token storage in OAuth2 / OIDC
 * implementations.
 */
function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time hex-string comparison to avoid timing attacks. */
function safeHashCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

interface GoogleTokenPayload {
  aud: string;
  email: string;
  email_verified: boolean | string;
  name?: string;
  picture?: string;
  sub: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private transporter;

  constructor(
    private usersService: UserService,
    private jwtService: JwtService,
  ) {
    // Configura el transportador de nodemailer
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.NOREPLY_EMAIL,
        pass: process.env.NOREPLY_PW,
      },
    });
  }

  async validateUser(username: string, password: string): Promise<User> {
    const user = await this.usersService.findByEmailOrUsername('', username);
    if (user && (await bcrypt.compare(password, user.password))) {
      return user;
    }
    return null;
  }

  async register(registerDto: RegisterUserDTO): Promise<void> {
    // Verifica que el correo y el username no estén ya en uso
    const existingUser = await this.usersService.findByEmailOrUsername(
      registerDto.email,
      registerDto.username,
    );
    if (existingUser) {
      throw new BadRequestException('Email or Username already in use');
    }
    const pw = await this.hashPassword(registerDto.password);

    // Genera un token de verificación
    const verificationToken = uuidv4();

    // Crea el usuario con el token de verificación
    const newUser = new User(
      registerDto.complete_name,
      registerDto.username,
      registerDto.email,
      pw,
      registerDto.profile_image,
      false, // Usuario no verificado
      registerDto.role,
    );
    newUser.resetToken = verificationToken;

    await this.usersService.create(newUser);

    await this.sendVerificationEmail(verificationToken, registerDto);
  }

  async authenticateWithGoogle(credential: string, username?: string) {
    const googleUser = await this.verifyGoogleToken(credential);
    let user = await this.usersService.findByGoogleId(googleUser.sub);
    let isNewUser = false;

    if (!user) {
      user = await this.usersService.findByEmailOrUsername(
        googleUser.email,
        '',
      );
    }

    if (user) {
      let shouldUpdate = false;

      if (user.googleId !== googleUser.sub) {
        user.googleId = googleUser.sub;
        shouldUpdate = true;
      }

      if (!user.verified) {
        user.verified = true;
        shouldUpdate = true;
      }

      if (!user.profileImage && googleUser.picture) {
        user.profileImage = googleUser.picture;
        shouldUpdate = true;
      }

      if (shouldUpdate) {
        user = await this.usersService.update(user.id, user);
      }
    } else {
      if (!username?.trim()) {
        throw new BadRequestException({
          message: 'Username is required for new Google signup',
          requiresUsername: true,
          suggestedUsername: await this.generateAvailableUsername(
            googleUser.email,
            googleUser.name,
          ),
        });
      }

      const selectedUsername = await this.resolveGoogleSignupUsername(
        username,
        googleUser.email,
        googleUser.name,
      );
      const generatedPassword = await this.hashPassword(uuidv4());
      const newUser = new User(
        googleUser.name || selectedUsername,
        selectedUsername,
        googleUser.email,
        generatedPassword,
        googleUser.picture || null,
        true,
        UserRole.Volunteer,
        undefined,
        [],
        [],
        [],
        [],
        googleUser.sub,
      );

      user = await this.usersService.create(newUser);
      isNewUser = true;
    }

    return {
      ...(await this.login(user)),
      isNewUser,
    };
  }

  async verifyEmail(token: string): Promise<User> {
    const user = await this.usersService.getUserByResetToken(token);
    if (!user) {
      throw new BadRequestException('Token inválido o expirado');
    }
    user.verifyAccount();
    user.resetToken = null;
    return await this.usersService.update(user.id, user);
  }

  private async sendVerificationEmail(
    verificationToken: string | Uint8Array,
    registerDto: RegisterUserDTO,
  ) {
    // Envía el correo de verificación
    const host = process.env.FRONTEND_URL;
    const verificationLink = `${host}/verify-email?token=${verificationToken}`;
    const mailOptions = {
      from: 'noreply@rayuela.com',
      to: registerDto.email,
      subject: 'Verificación de correo',
      text: `Por favor, verifica tu correo haciendo clic en el siguiente enlace: ${verificationLink}`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Verification email sent to ${registerDto.email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${registerDto.email}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException(
        'Error al enviar el correo de verificación',
      );
    }
  }

  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt();
    return bcrypt.hash(password, salt);
  }

  async login(user: User) {
    const payload = {
      username: user.username,
      sub: user.id,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    // Generate and persist a refresh token for THIS device. The userId is
    // prefixed onto the token so we can look up the owner on /auth/refresh
    // without requiring the client to also send a userId.
    const refreshToken = `${user.id}${REFRESH_TOKEN_SEPARATOR}${uuidv4()}`;

    await this.usersService.addRefreshSession(
      user.id,
      hashRefreshToken(refreshToken),
      refreshExpiry(),
      MAX_REFRESH_SESSIONS,
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      username: user.username,
    };
  }

  /**
   * Validates a refresh token and issues a fresh access token. The userId is
   * recovered from the refresh token itself (`${userId}.${secret}`), so the
   * client only needs to send the token.
   *
   * ponytail: the refresh token is deliberately NOT rotated — its expiry is
   * slid forward instead. Rotation needs a grace window for the old token,
   * otherwise any concurrent refresh (this app runs one in the background
   * isolate too) or any lost response permanently kills the session, which
   * is exactly the random-logout bug this replaces. If replay detection is
   * ever needed, add `{ prevHash, prevExpiry }` to the session entry and
   * accept the previous hash for ~60s rather than reverting to bare rotation.
   */
  async refreshAccessToken(refreshToken: string) {
    const separatorIndex = refreshToken.indexOf(REFRESH_TOKEN_SEPARATOR);
    if (separatorIndex <= 0) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const userId = refreshToken.slice(0, separatorIndex);

    const alive = await this.usersService.touchRefreshSession(
      userId,
      hashRefreshToken(refreshToken),
      refreshExpiry(),
      MAX_REFRESH_SESSIONS,
    );
    if (!alive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.getByUserId(userId);
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      access_token: this.jwtService.sign({
        username: user.username,
        sub: user.id,
        role: user.role,
      }),
      refresh_token: refreshToken,
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      username: user.username,
    };
  }

  /**
   * Server-side logout. With a refresh token, only that device's session is
   * dropped; without one (older clients) every session is dropped.
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.usersService.removeRefreshSession(
        userId,
        hashRefreshToken(refreshToken),
      );
      return;
    }
    await this.usersService.clearRefreshSessions(userId);
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmailOrUsername(email, '');
    if (!user) {
      throw new BadRequestException('Email not found');
    }

    const resetToken = uuidv4();
    await this.usersService.saveResetToken(user.id, resetToken);

    const host = process.env.FRONTEND_URL;

    const resetLink = `${host}/reset-password?token=${resetToken}`;
    const mailOptions = {
      from: 'noreply@rayuela.com', // Dirección de correo del remitente
      to: email, // Dirección de correo del destinatario
      subject: 'Contraseña olvidada', // Asunto del correo
      text: `Parece que has olvidado tu contraseña! Puedes resetearla en este link ${resetLink} `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async recoverPassword(token: string, newPassword: string) {
    const u = await this.usersService.getUserByResetToken(token);
    u.password = await this.hashPassword(newPassword);
    u.resetToken = null;
    return await this.usersService.update(u.id, u);
  }

  private async verifyGoogleToken(
    credential: string,
  ): Promise<GoogleTokenPayload> {
    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new BadRequestException('Google login is not configured');
    }

    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      );

      if (!response.ok) {
        throw new UnauthorizedException('Invalid Google credentials');
      }

      const payload = (await response.json()) as GoogleTokenPayload;

      if (!payload?.sub || !payload.email) {
        throw new UnauthorizedException('Invalid Google credentials');
      }

      if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
        throw new UnauthorizedException('Invalid Google credentials');
      }

      if (`${payload.email_verified}` !== 'true') {
        throw new UnauthorizedException('Google email is not verified');
      }

      return payload;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      this.logger.warn(
        `Google authentication failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new UnauthorizedException('Invalid Google credentials');
    }
  }

  private async generateAvailableUsername(email: string, name?: string | null) {
    const baseUsername =
      this.normalizeUsernameSeed(name) ||
      this.normalizeUsernameSeed(email.split('@')[0]) ||
      'rayuela_user';

    let candidate = baseUsername;
    let suffix = 1;

    while (await this.usersService.findByEmailOrUsername('', candidate)) {
      const suffixLabel = `_${suffix}`;
      candidate = `${baseUsername.slice(0, 30 - suffixLabel.length)}${suffixLabel}`;
      suffix += 1;
    }

    return candidate;
  }

  private async resolveGoogleSignupUsername(
    requestedUsername: string | undefined,
    email: string,
    name?: string | null,
  ) {
    const normalizedRequestedUsername = requestedUsername?.trim();

    if (normalizedRequestedUsername) {
      const existingUser = await this.usersService.findByEmailOrUsername(
        '',
        normalizedRequestedUsername,
      );

      if (existingUser) {
        throw new BadRequestException('Username already in use');
      }

      return normalizedRequestedUsername;
    }

    return this.generateAvailableUsername(email, name);
  }

  private normalizeUsernameSeed(seed?: string | null) {
    return (seed || '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '_')
      .replace(/^[_\-.]+|[_\-.]+$/g, '')
      .slice(0, 30);
  }
}
