// ═══════════════════════════════════════════════════════════
// apps/api/src/modules/production-calc/production-calc.controller.ts
// ═══════════════════════════════════════════════════════════
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ProductionCalcService } from './production-calc.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('production-calc')
@UseGuards(JwtAuthGuard)
export class ProductionCalcController {
  constructor(private readonly service: ProductionCalcService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: any) {
    return this.service.create(dto);
  }

  @Patch('output/:id/markup')
  updateMarkup(@Param('id') id: string, @Body() body: { markupPct: number }) {
    return this.service.updateMarkup(id, body.markupPct);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
