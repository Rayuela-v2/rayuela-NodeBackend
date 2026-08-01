import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from './users/user.service';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException } from '@nestjs/common';
import { User } from './users/user.entity';
import { UserRole } from './users/user.schema';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'node:crypto';
import { RegisterUserDTO } from './auth.controller';

// Mock de dependencias externas
jest.mock('bcryptjs');
jest.mock('uuid');
jest.mock('nodemailer');
jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));

// Refresh-token hashing is SHA-256 (real, deterministic) — no mocking needed.
const sha256Hex = (s: string) => createHash('sha256').update(s).digest('hex');

describe('AuthService', () => {
  let service: AuthService;

  const mockUserService = {
    findByEmailOrUsername: jest.fn(),
    findByGoogleId: jest.fn(),
    create: jest.fn(),
    getUserByResetToken: jest.fn(),
    update: jest.fn(),
    saveResetToken: jest.fn(),
    getByUserId: jest.fn(),
    addRefreshSession: jest.fn(),
    touchRefreshSession: jest.fn(),
    removeRefreshSession: jest.fn(),
    clearRefreshSessions: jest.fn(),
  };

  /**
   * In-memory stand-in for the `user.refreshTokens` array that UserDao
   * mutates with atomic operators. Returns the live array so tests can
   * assert on it.
   */
  const useFakeSessionStore = () => {
    const sessions: { hash: string; expiry: Date }[] = [];
    mockUserService.addRefreshSession.mockImplementation(
      async (_id, hash, expiry, max) => {
        sessions.push({ hash, expiry });
        if (sessions.length > max) sessions.splice(0, sessions.length - max);
      },
    );
    mockUserService.touchRefreshSession.mockImplementation(
      async (_id, hash, expiry) => {
        const hit = sessions.find(
          (s) => s.hash === hash && s.expiry > new Date(),
        );
        if (!hit) return false;
        hit.expiry = expiry;
        return true;
      },
    );
    mockUserService.removeRefreshSession.mockImplementation(
      async (_id, hash) => {
        const i = sessions.findIndex((s) => s.hash === hash);
        if (i >= 0) sessions.splice(i, 1);
      },
    );
    mockUserService.clearRefreshSessions.mockImplementation(async () => {
      sessions.length = 0;
    });
    return sessions;
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockTransporter = {
    sendMail: jest.fn(),
  };

  beforeEach(async () => {
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    global.fetch = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: mockUserService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user if validation is successful', async () => {
      const user = new User(
        'Test',
        'testuser',
        'test@test.com',
        'hashedpassword',
        '',
        false,
        UserRole.Volunteer,
      );
      mockUserService.findByEmailOrUsername.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('testuser', 'password');
      expect(result).toEqual(user);
      expect(mockUserService.findByEmailOrUsername).toHaveBeenCalledWith(
        '',
        'testuser',
      );
      expect(bcrypt.compare).toHaveBeenCalledWith('password', 'hashedpassword');
    });

    it('should return null if user not found', async () => {
      mockUserService.findByEmailOrUsername.mockResolvedValue(null);
      const result = await service.validateUser('testuser', 'password');
      expect(result).toBeNull();
    });

    it('should return null if password does not match', async () => {
      const user = new User(
        'Test',
        'testuser',
        'test@test.com',
        'hashedpassword',
        '',
        false,
        UserRole.Volunteer,
      );
      mockUserService.findByEmailOrUsername.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('testuser', 'password');
      expect(result).toBeNull();
    });
  });

  describe('register', () => {
    const registerDto: RegisterUserDTO = {
      complete_name: 'Test User',
      username: 'testuser',
      email: 'test@test.com',
      password: 'password',
      profile_image: '',
      role: UserRole.Volunteer,
    };

    it('should register a new user and send verification email', async () => {
      mockUserService.findByEmailOrUsername.mockResolvedValue(null);
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
      (uuidv4 as jest.Mock).mockReturnValue('test-token');
      mockUserService.create.mockResolvedValue(null);
      await service.register(registerDto);

      expect(mockUserService.findByEmailOrUsername).toHaveBeenCalledWith(
        registerDto.email,
        registerDto.username,
      );
      expect(bcrypt.hash).toHaveBeenCalledWith('password', 'salt');
      expect(mockUserService.create).toHaveBeenCalled();
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });

    it('should throw BadRequestException if email or username is already in use', async () => {
      const user = new User(
        'Test',
        'testuser',
        'test@test.com',
        'hashedpassword',
        '',
        false,
        UserRole.Volunteer,
      );
      mockUserService.findByEmailOrUsername.mockResolvedValue(user);
      await expect(service.register(registerDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if sending email fails', async () => {
      mockUserService.findByEmailOrUsername.mockResolvedValue(null);
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
      (uuidv4 as jest.Mock).mockReturnValue('test-token');
      mockUserService.create.mockResolvedValue(null);
      mockTransporter.sendMail.mockRejectedValueOnce(
        new Error('SMTP auth error'),
      );

      await expect(service.register(registerDto)).rejects.toThrow(
        new BadRequestException('Error al enviar el correo de verificación'),
      );
    });

    it('should propagate sendMail rejection — not swallow it silently', async () => {
      mockUserService.findByEmailOrUsername.mockResolvedValue(null);
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
      (uuidv4 as jest.Mock).mockReturnValue('test-token');
      mockUserService.create.mockResolvedValue(null);
      mockTransporter.sendMail.mockRejectedValueOnce(
        new Error('SMTP auth error'),
      );

      const loggerErrorSpy = jest.spyOn(service['logger'], 'error');

      await expect(service.register(registerDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(loggerErrorSpy).toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('should verify user email', async () => {
      const user = new User(
        'Test',
        'testuser',
        'test@test.com',
        'hashedpassword',
        '',
        false,
        UserRole.Volunteer,
      );
      user.resetToken = 'valid-token';
      user.verifyAccount = jest.fn();
      mockUserService.getUserByResetToken.mockResolvedValue(user);
      mockUserService.update.mockResolvedValue(user);

      const result = await service.verifyEmail('valid-token');

      expect(mockUserService.getUserByResetToken).toHaveBeenCalledWith(
        'valid-token',
      );
      expect(user.verifyAccount).toHaveBeenCalled();
      expect(result.resetToken).toBeNull();
      expect(mockUserService.update).toHaveBeenCalledWith(user.id, user);
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockUserService.getUserByResetToken.mockResolvedValue(null);
      await expect(service.verifyEmail('invalid-token')).rejects.toThrow(
        new BadRequestException('Token inválido o expirado'),
      );
    });
  });

  describe('hashPassword', () => {
    it('should return a hashed password', async () => {
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');

      const result = await service.hashPassword('password');
      expect(result).toBe('hashedpassword');
    });
  });

  describe('login', () => {
    it('should return access token, refresh token, expires_in, and username', async () => {
      const user = new User(
        'Test',
        'testuser',
        'test@test.com',
        'hashedpassword',
        '',
        false,
        UserRole.Volunteer,
      );
      user.id = 'user-id';
      mockJwtService.sign.mockReturnValue('test-token');
      (uuidv4 as jest.Mock).mockReturnValue('refresh-token-uuid');
      const sessions = useFakeSessionStore();

      const result = await service.login(user);

      const expectedRefreshToken = 'user-id.refresh-token-uuid';
      expect(result).toEqual({
        access_token: 'test-token',
        // Token is shaped as `${user.id}.${uuidv4()}` so the server can find
        // the owner on /auth/refresh.
        refresh_token: expectedRefreshToken,
        expires_in: 3600,
        username: 'testuser',
      });
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        username: user.username,
        sub: user.id,
        role: user.role,
      });
      // The persisted hash must be SHA-256 of the token we returned to the
      // client — anything else means refresh would never validate.
      expect(sessions).toEqual([
        { hash: sha256Hex(expectedRefreshToken), expiry: expect.any(Date) },
      ]);
    });

    it('should add a session per device instead of replacing the previous one', async () => {
      const user = new User(
        'Test',
        'testuser',
        'test@test.com',
        'hashedpassword',
        '',
        false,
        UserRole.Volunteer,
      );
      user.id = 'user-id';
      mockJwtService.sign.mockReturnValue('test-token');
      const sessions = useFakeSessionStore();

      (uuidv4 as jest.Mock).mockReturnValue('phone');
      const phone = await service.login(user);
      (uuidv4 as jest.Mock).mockReturnValue('laptop');
      const laptop = await service.login(user);

      // Signing in on a second device must not invalidate the first.
      expect(sessions.map((s) => s.hash)).toEqual([
        sha256Hex(phone.refresh_token),
        sha256Hex(laptop.refresh_token),
      ]);
    });
  });

  describe('authenticateWithGoogle', () => {
    const googlePayload = {
      sub: 'google-123',
      email: 'google@test.com',
      email_verified: true,
      name: 'Google User',
      picture: 'https://example.com/avatar.png',
    };

    it('should link an existing email account and return a session', async () => {
      const user = new User(
        'Test',
        'testuser',
        'google@test.com',
        'hashedpassword',
        '',
        false,
        UserRole.Volunteer,
      );
      user.id = 'user-id';
      mockUserService.findByGoogleId.mockResolvedValue(null);
      mockUserService.findByEmailOrUsername.mockResolvedValue(user);
      mockUserService.update.mockImplementation(
        async (_id, updatedUser) => updatedUser,
      );
      mockJwtService.sign.mockReturnValue('google-token');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          ...googlePayload,
          aud: 'google-client-id',
        }),
      });

      const result = await service.authenticateWithGoogle('credential');

      expect(mockUserService.findByGoogleId).toHaveBeenCalledWith('google-123');
      expect(mockUserService.update).toHaveBeenCalled();
      expect(user.googleId).toBe('google-123');
      expect(user.verified).toBe(true);
      expect(result).toMatchObject({
        access_token: 'google-token',
        username: 'testuser',
        isNewUser: false,
      });
      expect(result).toHaveProperty('refresh_token');
      expect(result).toHaveProperty('expires_in', 3600);
    });

    it('should create a verified user when the Google account is new and a username is provided', async () => {
      mockUserService.findByGoogleId.mockResolvedValue(null);
      mockUserService.findByEmailOrUsername
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockUserService.create.mockImplementation(async (user) => {
        user.id = 'new-user-id';
        return user;
      });
      mockJwtService.sign.mockReturnValue('google-token');
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
      (uuidv4 as jest.Mock).mockReturnValue('generated-secret');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          ...googlePayload,
          aud: 'google-client-id',
        }),
      });

      const result = await service.authenticateWithGoogle(
        'credential',
        'google_user',
      );

      expect(mockUserService.create).toHaveBeenCalled();
      expect(result).toMatchObject({
        access_token: 'google-token',
        username: 'google_user',
        isNewUser: true,
      });
      expect(result).toHaveProperty('refresh_token');
      expect(result).toHaveProperty('expires_in', 3600);
    });

    it('should request a username for a new Google signup when none is provided', async () => {
      mockUserService.findByGoogleId.mockResolvedValue(null);
      mockUserService.findByEmailOrUsername
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          ...googlePayload,
          aud: 'google-client-id',
        }),
      });

      await expect(
        service.authenticateWithGoogle('credential'),
      ).rejects.toMatchObject({
        response: {
          message: 'Username is required for new Google signup',
          requiresUsername: true,
          suggestedUsername: 'google_user',
        },
      });
    });

    it('should create a verified user with the requested username', async () => {
      mockUserService.findByGoogleId.mockResolvedValue(null);
      mockUserService.findByEmailOrUsername
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockUserService.create.mockImplementation(async (user) => {
        user.id = 'new-user-id';
        return user;
      });
      mockJwtService.sign.mockReturnValue('google-token');
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
      (uuidv4 as jest.Mock).mockReturnValue('generated-secret');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          ...googlePayload,
          aud: 'google-client-id',
        }),
      });

      const result = await service.authenticateWithGoogle(
        'credential',
        'chosen-user',
      );

      expect(mockUserService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'chosen-user',
        }),
      );
      expect(result).toMatchObject({
        access_token: 'google-token',
        username: 'chosen-user',
        isNewUser: true,
      });
      expect(result).toHaveProperty('refresh_token');
      expect(result).toHaveProperty('expires_in', 3600);
    });

    it('should reject requested usernames already in use for a new Google user', async () => {
      mockUserService.findByGoogleId.mockResolvedValue(null);
      mockUserService.findByEmailOrUsername
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(
          new User('Taken', 'taken-user', 'taken@test.com', 'password'),
        );
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          ...googlePayload,
          aud: 'google-client-id',
        }),
      });

      await expect(
        service.authenticateWithGoogle('credential', 'taken-user'),
      ).rejects.toThrow('Username already in use');
    });

    it('should reject invalid Google credentials', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
      });

      await expect(
        service.authenticateWithGoogle('credential'),
      ).rejects.toThrow('Invalid Google credentials');
    });
  });

  describe('forgotPassword', () => {
    it('should send a password reset email', async () => {
      const user = new User(
        'Test',
        'testuser',
        'test@test.com',
        'hashedpassword',
        '',
        false,
        UserRole.Volunteer,
      );
      user.id = 'user-id';
      mockUserService.findByEmailOrUsername.mockResolvedValue(user);
      (uuidv4 as jest.Mock).mockReturnValue('reset-token');

      await service.forgotPassword('test@test.com');

      expect(mockUserService.findByEmailOrUsername).toHaveBeenCalledWith(
        'test@test.com',
        '',
      );
      expect(mockUserService.saveResetToken).toHaveBeenCalledWith(
        'user-id',
        'reset-token',
      );
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });

    it('should throw BadRequestException if email not found', async () => {
      mockUserService.findByEmailOrUsername.mockResolvedValue(null);
      await expect(service.forgotPassword('test@test.com')).rejects.toThrow(
        new BadRequestException('Email not found'),
      );
    });

    it('should not throw when sending email fails — logs error and continues', async () => {
      const user = new User(
        'Test',
        'testuser',
        'test@test.com',
        'hashedpassword',
        '',
        false,
        UserRole.Volunteer,
      );
      user.id = 'user-id';
      mockUserService.findByEmailOrUsername.mockResolvedValue(user);
      (uuidv4 as jest.Mock).mockReturnValue('reset-token');
      mockTransporter.sendMail.mockRejectedValueOnce(
        new Error('SMTP auth error'),
      );

      const loggerErrorSpy = jest.spyOn(service['logger'], 'error');

      await expect(
        service.forgotPassword('test@test.com'),
      ).resolves.toBeUndefined();
      expect(loggerErrorSpy).toHaveBeenCalled();
    });

    it('should log success when email is sent', async () => {
      const user = new User('T', 'u', 'test@test.com', 'p');
      user.id = 'user-id';
      mockUserService.findByEmailOrUsername.mockResolvedValue(user);
      mockTransporter.sendMail.mockResolvedValueOnce(undefined);

      const loggerLogSpy = jest.spyOn(service['logger'], 'log');

      await service.forgotPassword('test@test.com');
      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('test@test.com'),
      );
    });
  });

  describe('recoverPassword', () => {
    it('should recover user password', async () => {
      const user = new User(
        'Test',
        'testuser',
        'test@test.com',
        'oldpassword',
        '',
        false,
        UserRole.Volunteer,
      );
      user.id = 'user-id';
      mockUserService.getUserByResetToken.mockResolvedValue(user);
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('newhashedpassword');
      mockUserService.update.mockResolvedValue({
        ...user,
        password: 'newhashedpassword',
        resetToken: null,
      });

      const result = await service.recoverPassword(
        'reset-token',
        'newpassword',
      );

      expect(mockUserService.getUserByResetToken).toHaveBeenCalledWith(
        'reset-token',
      );
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword', 'salt');
      expect(mockUserService.update).toHaveBeenCalledWith(
        'user-id',
        expect.any(User),
      );
      expect(result.password).toBe('newhashedpassword');
      expect(result.resetToken).toBeNull();
    });
  });

  describe('refreshAccessToken', () => {
    /** Helper: a user with one live session for `refreshToken`. */
    const signedInUser = () => {
      const u = new User(
        'Test',
        'testuser',
        'test@test.com',
        'hashedpassword',
        '',
        true,
        UserRole.Volunteer,
      );
      u.id = 'user-id';
      return u;
    };

    it('should return a new access token and keep the same refresh token', async () => {
      const user = signedInUser();
      const sessions = useFakeSessionStore();
      sessions.push({
        hash: sha256Hex('user-id.valid-secret'),
        expiry: new Date(Date.now() + 1000 * 60 * 60),
      });
      mockUserService.getByUserId.mockResolvedValue(user);
      mockJwtService.sign.mockReturnValue('new-access-token');

      const result = await service.refreshAccessToken('user-id.valid-secret');

      expect(result).toMatchObject({
        access_token: 'new-access-token',
        // Not rotated: the client keeps the token it already has.
        refresh_token: 'user-id.valid-secret',
        expires_in: 3600,
        username: 'testuser',
      });
    });

    it('should slide the expiry forward on every refresh', async () => {
      const user = signedInUser();
      const sessions = useFakeSessionStore();
      const nearlyExpired = new Date(Date.now() + 1000 * 60);
      sessions.push({
        hash: sha256Hex('user-id.valid-secret'),
        expiry: nearlyExpired,
      });
      mockUserService.getByUserId.mockResolvedValue(user);
      mockJwtService.sign.mockReturnValue('new-access-token');

      await service.refreshAccessToken('user-id.valid-secret');

      // A user who keeps opening the app never runs out of session.
      expect(sessions[0].expiry.getTime()).toBeGreaterThan(
        nearlyExpired.getTime(),
      );
    });

    it('should survive two concurrent refreshes with the same token', async () => {
      const user = signedInUser();
      const sessions = useFakeSessionStore();
      sessions.push({
        hash: sha256Hex('user-id.valid-secret'),
        expiry: new Date(Date.now() + 1000 * 60 * 60),
      });
      mockUserService.getByUserId.mockResolvedValue(user);
      mockJwtService.sign.mockReturnValue('new-access-token');

      // The mobile app refreshes from the UI isolate and the background
      // sync isolate; under rotation the loser used to be signed out.
      const [a, b] = await Promise.all([
        service.refreshAccessToken('user-id.valid-secret'),
        service.refreshAccessToken('user-id.valid-secret'),
      ]);

      expect(a.refresh_token).toBe('user-id.valid-secret');
      expect(b.refresh_token).toBe('user-id.valid-secret');
      expect(sessions).toHaveLength(1);
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      const sessions = useFakeSessionStore();
      sessions.push({
        hash: sha256Hex('user-id.correct-secret'),
        expiry: new Date(Date.now() + 1000 * 60 * 60),
      });
      mockUserService.getByUserId.mockResolvedValue(signedInUser());

      await expect(
        service.refreshAccessToken('user-id.wrong-secret'),
      ).rejects.toThrow('Invalid refresh token');
    });

    it('should throw UnauthorizedException for expired refresh token', async () => {
      const sessions = useFakeSessionStore();
      sessions.push({
        hash: sha256Hex('user-id.some-secret'),
        expiry: new Date(Date.now() - 1000),
      });
      mockUserService.getByUserId.mockResolvedValue(signedInUser());

      await expect(
        service.refreshAccessToken('user-id.some-secret'),
      ).rejects.toThrow('Invalid refresh token');
    });

    it('should throw UnauthorizedException if the user has no session', async () => {
      useFakeSessionStore();
      mockUserService.getByUserId.mockResolvedValue(signedInUser());

      await expect(
        service.refreshAccessToken('user-id.some-secret'),
      ).rejects.toThrow('Invalid refresh token');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const sessions = useFakeSessionStore();
      sessions.push({
        hash: sha256Hex('nonexistent.some-secret'),
        expiry: new Date(Date.now() + 1000 * 60 * 60),
      });
      mockUserService.getByUserId.mockResolvedValue(null);

      await expect(
        service.refreshAccessToken('nonexistent.some-secret'),
      ).rejects.toThrow('Invalid refresh token');
    });

    it('should throw UnauthorizedException if token is malformed (no separator)', async () => {
      await expect(
        service.refreshAccessToken('no-separator-here'),
      ).rejects.toThrow('Invalid refresh token');
      expect(mockUserService.touchRefreshSession).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if token has empty userId portion', async () => {
      await expect(service.refreshAccessToken('.secret')).rejects.toThrow(
        'Invalid refresh token',
      );
      expect(mockUserService.touchRefreshSession).not.toHaveBeenCalled();
    });

    it('should reject the refresh token after logout', async () => {
      const token = 'user-id.some-secret';
      const sessions = useFakeSessionStore();
      sessions.push({
        hash: sha256Hex(token),
        expiry: new Date(Date.now() + 1000 * 60 * 60),
      });
      mockUserService.getByUserId.mockResolvedValue(signedInUser());

      await service.logout('user-id', token);

      await expect(service.refreshAccessToken(token)).rejects.toThrow(
        'Invalid refresh token',
      );
    });
  });

  describe('logout', () => {
    it('should drop only the calling device session', async () => {
      const sessions = useFakeSessionStore();
      sessions.push(
        {
          hash: sha256Hex('user-id.phone'),
          expiry: new Date(Date.now() + 1000),
        },
        {
          hash: sha256Hex('user-id.laptop'),
          expiry: new Date(Date.now() + 1000),
        },
      );

      await service.logout('user-id', 'user-id.phone');

      expect(sessions.map((s) => s.hash)).toEqual([
        sha256Hex('user-id.laptop'),
      ]);
    });

    it('should drop every session when no refresh token is given', async () => {
      const sessions = useFakeSessionStore();
      sessions.push({
        hash: sha256Hex('user-id.phone'),
        expiry: new Date(Date.now() + 1000),
      });

      await service.logout('user-id');

      expect(sessions).toHaveLength(0);
    });

    it('should not throw if user not found', async () => {
      useFakeSessionStore();
      mockUserService.getByUserId.mockResolvedValue(null);
      await expect(service.logout('nonexistent')).resolves.toBeUndefined();
    });
  });
});
