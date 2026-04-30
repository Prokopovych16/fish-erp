import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CashService } from './cash.service';
import { CreateCashEntryDto, UpdateCashEntryDto } from './dto/cash-entry.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('cash')
export class CashController {
  constructor(private cashService: CashService) {}

  @Get()
  getEntries(@Query('year') year: string, @Query('month') month: string) {
    return this.cashService.getEntries(Number(year), Number(month));
  }

  @Get('summaries')
  getSummaries() {
    return this.cashService.getSummaries();
  }

  @Post()
  create(@Body() dto: CreateCashEntryDto) {
    return this.cashService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCashEntryDto) {
    return this.cashService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cashService.remove(id);
  }
}
