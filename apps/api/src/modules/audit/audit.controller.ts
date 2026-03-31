import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN) // тільки адмін бачить аудит
@Controller('audit')
export class AuditController {
  constructor(private auditService: AuditService) {}

  // GET /api/audit?userId=...&action=...&from=...&to=...&page=1&limit=50
  @Get()
  findAll(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entityId') entityId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.findAll({
      userId,
      action,
      entityId,
      from,
      to,
      page,
      limit,
    });
  }
}
