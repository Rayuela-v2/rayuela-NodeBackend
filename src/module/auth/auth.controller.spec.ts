import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from './users/user.schema';

jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));
jest.mock('@nestjs/passport', () => ({
  AuthGuard: () => {
    return class MockGuard {
      canActivate() {
        return true;
      }
    };
  },
}));

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  const mockAuthService = {
    validateUser: jest.fn(),
    login: jest.fn(),
    authenticateWithGoogle: jest.fn(),
    recoverPassword: jest.fn(),
    forgotPassword: jest.fn(),
    verifyEmail: jest.fn(),
    register: jest.fn(),
    refreshAccessToken: jest.fn(),
    logout: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should login successfully', async () => {
      const body = { username: 'test', password: 'password' };
      const user = { username: 'test' };
      mockAuthService.validateUser.mockResolvedValue(user);
      mockAuthService.login.mockResolvedValue({
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 3600,
        username: 'test',
      });

      const result = await controller.login(body);
      expect(result).toEqual({
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 3600,
        username: 'test',
      });
    });

    it('should throw BadRequestException if missing fields', async () => {
      await expect(
        controller.login({ username: '', password: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException if invalid credentials', async () => {
      mockAuthService.validateUser.mockResolvedValue(null);
      await expect(
        controller.login({ username: 'test', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('recoverPassword', () => {
    it('should recover password successfully', async () => {
      const body = { token: 'token', newPassword: 'new' };
      await controller.recoverPassword(body);
      expect(service.recoverPassword).toHaveBeenCalledWith('token', 'new');
    });

    it('should throw BadRequestException if missing fields', async () => {
      await expect(
        controller.recoverPassword({ token: '', newPassword: '' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('forgotPassword', () => {
    it('should send forgot password email', async () => {
      await controller.forgotPassword({ email: 'test@test.com' });
      expect(service.forgotPassword).toHaveBeenCalledWith('test@test.com');
    });

    it('should throw BadRequestException if missing email', async () => {
      await expect(controller.forgotPassword({ email: '' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('verifyToken', () => {
    it('should verify token successfully', async () => {
      const user = { username: 'test' };
      mockAuthService.verifyEmail.mockResolvedValue(user);
      const result = await controller.verifyToken({ token: 'token' });
      expect(result.user).toEqual(user);
    });

    it('should throw BadRequestException if missing token', async () => {
      await expect(controller.verifyToken({ token: '' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw UnauthorizedException if token invalid', async () => {
      mockAuthService.verifyEmail.mockResolvedValue(null);
      await expect(
        controller.verifyToken({ token: 'invalid' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    const registerDto = {
      complete_name: 'Test',
      username: 'test',
      email: 'test@test.com',
      password: 'pass',
      role: UserRole.Volunteer,
    };

    it('should register successfully', async () => {
      await controller.register(registerDto);
      expect(service.register).toHaveBeenCalledWith(registerDto);
    });

    it('should throw BadRequestException if missing fields', async () => {
      await expect(
        controller.register({ ...registerDto, username: '' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('authenticateWithGoogle', () => {
    it('should authenticate with Google successfully', async () => {
      mockAuthService.authenticateWithGoogle.mockResolvedValue({
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 3600,
        username: 'test',
      });

      const result = await controller.authenticateWithGoogle({
        credential: 'google-token',
        username: 'chosen-user',
      });

      expect(result).toEqual({
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 3600,
        username: 'test',
      });
      expect(service.authenticateWithGoogle).toHaveBeenCalledWith(
        'google-token',
        'chosen-user',
      );
    });

    it('should throw BadRequestException if credential is missing', async () => {
      await expect(
        controller.authenticateWithGoogle({ credential: '' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refresh', () => {
    it('should refresh tokens successfully', async () => {
      mockAuthService.refreshAccessToken.mockResolvedValue({
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
        username: 'test',
      });

      const result = await controller.refresh({
        refreshToken: 'user-id.old-refresh',
      });

      expect(result).toEqual({
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
        username: 'test',
      });
      expect(service.refreshAccessToken).toHaveBeenCalledWith(
        'user-id.old-refresh',
      );
    });

    it('should throw BadRequestException if refreshToken is missing', async () => {
      await expect(controller.refresh({ refreshToken: '' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('logout', () => {
    it('should logout only the calling device', async () => {
      const req = { user: { userId: 'user-id' } };
      const result = await controller.logout(req, {
        refreshToken: 'user-id.secret',
      });

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(service.logout).toHaveBeenCalledWith('user-id', 'user-id.secret');
    });

    it('should logout every device when no refresh token is sent', async () => {
      const req = { user: { userId: 'user-id' } };
      await controller.logout(req, {});

      expect(service.logout).toHaveBeenCalledWith('user-id', undefined);
    });
  });
});
