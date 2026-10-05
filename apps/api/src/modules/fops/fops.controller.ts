import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { FopsService, FopDto } from './fops.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fops')
export class FopsController {
  constructor(private fopsService: FopsService) {}

  @Get()
  findAll() {
    return this.fopsService.findAll();
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: FopDto) {
    return this.fopsService.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<FopDto>) {
    return this.fopsService.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.fopsService.remove(id);
  }
}
