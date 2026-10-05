import { Module } from '@nestjs/common';
import { FopsController } from './fops.controller';
import { FopsService } from './fops.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [FopsController],
  providers: [FopsService, PrismaService],
  exports: [FopsService],
})
export class FopsModule {}
