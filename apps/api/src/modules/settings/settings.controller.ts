import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
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

  // PUT /api/settings — зберегти налаштування (тільки ADMIN)
  // Приймає довільний об'єкт { companyName: '...', edrpou: '...' }
  @Roles(UserRole.ADMIN)
  @Put()
  update(@Body() data: Record<string, string>) {
    return this.settingsService.update(data);
  }
}
