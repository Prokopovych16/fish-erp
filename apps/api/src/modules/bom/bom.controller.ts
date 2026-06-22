import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { BomService } from './bom.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('bom')
export class BomController {
  constructor(private bomService: BomService) {}

  @Get()
  findAll() {
    return this.bomService.findAll();
  }

  @Post()
  create(@Body() dto: { outputProductId: string; inputProductId: string; yieldPct: number; leadDays?: number; note?: string }) {
    return this.bomService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: { yieldPct?: number; leadDays?: number; note?: string }) {
    return this.bomService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.bomService.delete(id);
  }
}
