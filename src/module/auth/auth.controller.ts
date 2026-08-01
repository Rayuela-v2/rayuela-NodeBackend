import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  BadRequestException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { UserRole } from './users/user.schema';

export interface RegisterUserDTO {
  complete_name: string;
  username: string;
  email: string;
  password: string;
  profile_image?: string;
  role?: UserRole; // Por default es volunteer
}

export interface GoogleAuthDTO {
  credential: string;
  username?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    const { username, password } = body;

    // Verifica si ambos campos están presentes
    if (!username || !password) {
      throw new BadRequestException('Username and password are required');
    }

    // Valida el usuario por email y contraseña
    const user = await this.authService.validateUser(username, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Retorna el token de acceso
    return this.authService.login(user);
  }

  @Post('recover-password')
  async recoverPassword(@Body() body: { token: string; newPassword: string }) {
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      throw new BadRequestException('Token and new password are required');
    }

    await this.authService.recoverPassword(token, newPassword);
    return {
      message: 'Password has been successfully updated',
    };
  }
  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    const { email } = body;

    if (!email) {
      throw new BadRequestException('Email is required');
    }

    await this.authService.forgotPassword(email);
    return {
      message:
        'If an account with that email exists, a reset link has been sent',
    };
  }

  @Post('verify-email')
  async verifyToken(@Body() body: { token: string }) {
    const { token } = body;

    if (!token) {
      throw new BadRequestException('Token is required');
    }

    const user = await this.authService.verifyEmail(token);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return {
      message: 'Token is valid',
      user,
    };
  }

  @Post('register')
  async register(
    @Body()
    body: RegisterUserDTO,
  ) {
    const { complete_name, username, email, password, profile_image, role } =
      body;

    // Verifica si los campos obligatorios están presentes
    if (!complete_name || !username || !email || !password) {
      throw new BadRequestException(
        'Complete name, username, email, and password are required',
      );
    }

    return this.authService.register({
      complete_name,
      username,
      email,
      password,
      profile_image,
      role,
    });
  }

  @Post('google')
  async authenticateWithGoogle(@Body() body: GoogleAuthDTO) {
    const { credential, username } = body;

    if (!credential) {
      throw new BadRequestException('Google credential is required');
    }

    return this.authService.authenticateWithGoogle(credential, username);
  }

  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    const { refreshToken } = body;

    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    return this.authService.refreshAccessToken(refreshToken);
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  async logout(@Req() req, @Body() body: { refreshToken?: string }) {
    // Only this device's session is dropped when the client sends its
    // refresh token; other devices stay signed in.
    await this.authService.logout(req.user.userId, body?.refreshToken);
    return { message: 'Logged out successfully' };
  }
}
