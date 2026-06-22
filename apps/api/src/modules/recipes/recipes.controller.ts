import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { RecipesService } from './recipes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('recipes')
export class RecipesController {
  constructor(private recipesService: RecipesService) {}

  @Get()
  findAllSheets() {
    return this.recipesService.findAllSheets();
  }

  @Get(':id')
  findOneSheet(@Param('id') id: string) {
    return this.recipesService.findOneSheet(id);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  createSheet(@Body() dto: { name: string; icon?: string; description?: string }) {
    return this.recipesService.createSheet(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch('reorder')
  reorderSheets(@Body() dto: { orderedIds: string[] }) {
    return this.recipesService.reorderSheets(dto.orderedIds);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  updateSheet(@Param('id') id: string, @Body() dto: { name?: string; icon?: string; description?: string }) {
    return this.recipesService.updateSheet(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  deleteSheet(@Param('id') id: string) {
    return this.recipesService.deleteSheet(id);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/stages')
  createStage(
    @Param('id') id: string,
    @Body() dto: {
      name: string; content?: string; tempInfo?: string; timeInfo?: string; isCriticalPoint?: boolean;
      ingredients?: { name: string; amount: string }[];
    },
  ) {
    return this.recipesService.createStage(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/stages/reorder')
  reorderStages(@Param('id') id: string, @Body() dto: { orderedIds: string[] }) {
    return this.recipesService.reorderStages(id, dto.orderedIds);
  }

  @Roles(UserRole.ADMIN)
  @Patch('stages/:stageId')
  updateStage(
    @Param('stageId') stageId: string,
    @Body() dto: {
      name?: string; content?: string; tempInfo?: string; timeInfo?: string; isCriticalPoint?: boolean;
      ingredients?: { name: string; amount: string }[];
    },
  ) {
    return this.recipesService.updateStage(stageId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete('stages/:stageId')
  deleteStage(@Param('stageId') stageId: string) {
    return this.recipesService.deleteStage(stageId);
  }

  @Roles(UserRole.ADMIN)
  @Post('upload-image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(__dirname, '..', '..', '..', 'uploads', 'recipes'),
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
          cb(null, unique);
        },
      }),
      limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.includes(file.mimetype)) {
          return cb(new BadRequestException('Дозволені лише зображення (jpeg, png, webp, gif)'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл не передано');
    return { url: `/uploads/recipes/${file.filename}` };
  }
}
