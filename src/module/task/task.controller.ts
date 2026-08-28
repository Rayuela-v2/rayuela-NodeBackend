import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/role.decorator';
import { UserRole } from '../auth/users/user.schema';

@Controller('task')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  @Post('/project/:id/bulk')
  postBulk(
    @Param('id') projectId: string,
    @Body() createTaskDtoList: CreateTaskDto[],
  ) {
    return this.taskService.bulkSave(projectId, createTaskDtoList);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  @Delete('/project/:id/useless')
  removeUselessFromProject(@Param('id') projectId: string) {
    return this.taskService.removeUselessFrom(projectId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  @Post()
  create(@Body() createTaskDto: CreateTaskDto) {
    return this.taskService.create(CreateTaskDto.fromDTO(createTaskDto));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  @Get('/admin/project/:id')
  async findForAdmin(@Param('id') projectId: string) {
    return await this.taskService.findForAdmin(projectId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/project/:id')
  async findAllByProject(@Param('id') projectId: string, @Req() req) {
    return await this.taskService.findRawByProjectId(
      projectId,
      req.user.username,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.taskService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto) {
    return this.taskService.update(id, updateTaskDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.taskService.remove(id);
  }
}
