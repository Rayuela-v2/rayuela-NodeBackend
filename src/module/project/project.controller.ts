import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Patch,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { UserRole } from '../auth/users/user.schema';
import { Roles } from '../auth/role.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectService } from './project.service';
import { UserService } from '../auth/users/user.service';
import { UpdateProjectDto } from './dto/update-project.dto';

@Controller('projects')
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly userService: UserService,
  ) {}

  @Get('/task-combinations/:id')
  getTaskCombination(@Param('id') id: string) {
    return this.projectService.getTaskCombinations(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.projectService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  @Post()
  create(@Body() createProjectDto: CreateProjectDto, @Req() req) {
    createProjectDto.ownerId = req.user.userId;
    return this.projectService.create(createProjectDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;
    return this.projectService.findOne(id, userId);
  }

  @Get('public/:id')
  findOnePublic(@Param('id') id: string) {
    return this.projectService.findOnePublic(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectService.update(id, updateProjectDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  @Post('/availability/:id')
  toggleAvailable(@Param('id') id: string) {
    return this.projectService.toggleAvailable(id);
  }
}
