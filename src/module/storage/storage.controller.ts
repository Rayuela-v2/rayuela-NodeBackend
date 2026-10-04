import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  NotFoundException,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { StorageService } from './storage.service';
import { Response } from 'express';
import { Stream } from 'stream';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/role.decorator';
import { UserRole } from '../auth/users/user.schema';

const ALLOWED_ADMIN_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const MAX_ADMIN_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_STORAGE_FOLDERS = new Set(['badges', 'projects']);

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get('file')
  async getFile(@Query('key') key: string, @Res() res: Response) {
    try {
      const { body, contentType } = await this.storageService.getFile(key);

      res.setHeader('Content-Type', contentType || 'application/octet-stream');

      if (body instanceof Stream) {
        body.pipe(res);
      } else if (body && typeof body.pipe === 'function') {
        body.pipe(res);
      } else {
        // Fallback for cases where it's not a stream (though S3 usually returns one)
        res.send(body);
      }
    } catch (error) {
      throw new NotFoundException('File not found');
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_ADMIN_IMAGE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_ADMIN_IMAGE_MIMES.has(file.mimetype)) {
          cb(null, true);
          return;
        }
        cb(
          new BadRequestException(
            `Unsupported file type: ${file.mimetype}. Allowed types: image/jpeg, image/png, image/webp`,
          ),
          false,
        );
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder: string = 'badges',
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const targetFolder = ALLOWED_STORAGE_FOLDERS.has(folder)
      ? folder
      : 'badges';
    const isBadge = targetFolder === 'badges';

    // Optimize image with Sharp:
    // Badges: max 512px, quality 85.
    // Projects: max 1600px, quality 80.
    const optimizedFile = await this.storageService.optimizeImage(file, {
      maxDimension: isBadge ? 512 : 1600,
      quality: isBadge ? 85 : 80,
    });

    const key = await this.storageService.uploadFile(
      optimizedFile,
      targetFolder,
    );

    return {
      key,
      url: `/storage/file?key=${encodeURIComponent(key)}`,
    };
  }
}
