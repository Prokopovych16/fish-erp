// ═══════════════════════════════════════════════════════════
// apps/api/src/modules/production-calc/production-calc.module.ts
// ═══════════════════════════════════════════════════════════
import { Module } from '@nestjs/common';
import { ProductionCalcController } from './production-calc.controller';
import { ProductionCalcService } from './production-calc.service';
import { PrismaService } from '../../prisma.service';
@Module({
  controllers: [ProductionCalcController],
  providers: [ProductionCalcService, PrismaService],
})
export class ProductionCalcModule {}
