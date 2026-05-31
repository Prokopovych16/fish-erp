import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode,
} from '@nestjs/common';
import { StoresService } from './stores.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stores')
export class StoresController {
  constructor(private storesService: StoresService) {}

  @Get()
  findAll(
    @Query('oblasts') oblasts?: string,
    @Query('chains') chains?: string,
    @Query('isWorking') isWorking?: string,
    @Query('isNew') isNew?: string,
    @Query('search') search?: string,
  ) {
    return this.storesService.findAll({
      oblasts: oblasts ? oblasts.split(',').filter(Boolean) : undefined,
      chains: chains ? chains.split(',').filter(Boolean) : undefined,
      isWorking: isWorking === 'true' ? true : isWorking === 'false' ? false : undefined,
      isNew: isNew === 'true' ? true : isNew === 'false' ? false : undefined,
      search,
    });
  }

  @Get('chains')
  getChains() {
    return this.storesService.getChains();
  }

  @Get('stats')
  getStats() {
    return this.storesService.getStats();
  }

  @Roles(UserRole.ADMIN)
  @Post('sync')
  sync(@Body() body: { oblast: string }) {
    return this.storesService.syncOblast(body.oblast);
  }

  @Get('sync-status/:oblast')
  syncStatus(@Param('oblast') oblast: string) {
    return this.storesService.getSyncStatus(oblast);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/toggle')
  toggleWorking(@Param('id') id: string, @Body() body: { notes?: string }) {
    return this.storesService.toggleWorking(id, body.notes);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/notes')
  updateNotes(@Param('id') id: string, @Body() body: { notes: string }) {
    return this.storesService.updateNotes(id, body.notes);
  }

  @Roles(UserRole.ADMIN)
  @HttpCode(204)
  @Delete(':id')
  deleteStore(@Param('id') id: string) {
    return this.storesService.deleteStore(id);
  }

  @Roles(UserRole.ADMIN)
  @Post('manual')
  createManual(@Body() body: {
    name: string; lat: number; lng: number; oblast: string;
    chain?: string; address?: string; city?: string; phone?: string;
  }) {
    return this.storesService.createManual(body);
  }

  @Roles(UserRole.ADMIN)
  @Post(':oblast/mark-seen')
  markSeen(@Param('oblast') oblast: string) {
    return this.storesService.markAllSeenInOblast(oblast);
  }
}
