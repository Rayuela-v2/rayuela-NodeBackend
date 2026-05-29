import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';
import { CheckinService } from './checkin.service';
import { CreateCheckinDto } from './dto/create-checkin.dto';
import { UpdateCheckinDto } from './dto/update-checkin.dto';
import { AdminCheckinQueryDto } from './dto/admin-checkin-query.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/role.decorator';
import { UserRole } from '../auth/users/user.schema';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ALLOWED_IMAGE_MIMES,
  IDEMPOTENCY_HEADER,
  MAX_IMAGES_PER_CHECKIN,
  MAX_IMAGE_SIZE_BYTES,
} from './checkin.constants';

@Controller('checkin')
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FilesInterceptor('image', MAX_IMAGES_PER_CHECKIN, {
      // Multer enforces this and emits a `MulterError('LIMIT_FILE_SIZE')`
      // we map to HTTP 413 in `MulterExceptionFilter`.
      limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
          cb(null, true);
          return;
        }
        const error = new MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
        error.message =
          `Unsupported image type: ${file.mimetype}. ` +
          `Allowed: ${[...ALLOWED_IMAGE_MIMES].join(', ')}`;
        cb(error, false);
      },
    }),
  )
  async create(
    @Body() createCheckinDto: CreateCheckinDto,
    @Req() req: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Headers(IDEMPOTENCY_HEADER) idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    createCheckinDto.userId = req.user.userId;
    const result = await this.checkinService.create({
      createCheckinDto,
      files,
      idempotencyKey,
    });
    // When the service replays a previously-stored idempotency key we
    // surface it via a header so the mobile drainer (and any other
    // automated client) can tell apart a fresh insert from a replay.
    if (
      result &&
      'replayed' in result &&
      result.replayed &&
      typeof result.id === 'string'
    ) {
      res.setHeader('X-Original-Resource', result.id);
    }
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('/rate')
  async rate(
    @Body() rateBody: { checkinId: string; rate: number },
    @Req() req,
  ) {
    const userId = req.user.userId;
    return this.checkinService.rate({ ...rateBody, userId });
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/:projectId')
  async findUserCheckins(@Req() req, @Param('projectId') projectId: string) {
    const userId = req.user.userId;
    return this.checkinService.findByProjectId(userId, projectId);
  }

  /**
   * Admin-only listing of every checkin for `projectId`. Supports filters
   * (taskName, taskType, hasPhotos, location radius, userId, dateRange,
   * contributed) plus pagination via `page` and `limit`.
   *
   * Mounted under the more specific `admin/...` path so it doesn't collide
   * with `GET /checkin/:id`.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  @Get('admin/project/:projectId')
  async findForAdmin(
    @Param('projectId') projectId: string,
    @Query() query: AdminCheckinQueryDto,
  ) {
    return this.checkinService.findForAdmin(projectId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll() {
    return this.checkinService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.checkinService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCheckinDto: UpdateCheckinDto,
  ) {
    return this.checkinService.update(id, updateCheckinDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.checkinService.remove(id);
  }
}
