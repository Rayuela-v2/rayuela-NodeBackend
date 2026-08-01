import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth.guard';
import { RolesGuard } from '../roles.guard';
import { UpdateProfileDTO, UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  async getUserInfo(@Req() req) {
    return await this.userService.findByEmailOrUsername('', req.user.username);
  }

  /**
   * Edición del propio perfil. El usuario del token es el único que se puede
   * modificar — no se acepta un id por parámetro.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch()
  async updateUserInfo(@Req() req, @Body() body: UpdateProfileDTO) {
    return await this.userService.updateProfile(req.user.username, body ?? {});
  }
}
