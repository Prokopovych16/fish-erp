import { Controller, Get, Put, Body, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  // GET /api/settings — отримати всі налаштування
  @Get()
  getAll() {
    return this.settingsService.getAll();
  }

  // GET /api/settings/backup — завантажити дамп БД (тільки ADMIN)
  @Roles(UserRole.ADMIN)
  @Get('backup')
  async backup(@Res() res: Response) {
    const dump = await this.settingsService.backupDatabase();
    const date = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': 'application/sql',
      'Content-Disposition': `attachment; filename="fish-erp-backup-${date}.sql"`,
      'Content-Length': dump.length,
    });
    res.end(dump);
  }

  // PUT /api/settings — зберегти налаштування (тільки ADMIN)
  // Приймає довільний об'єкт { companyName: '...', edrpou: '...' }
  @Roles(UserRole.ADMIN)
  @Put()
  update(@Body() data: Record<string, string>) {
    return this.settingsService.update(data);
  }
}
