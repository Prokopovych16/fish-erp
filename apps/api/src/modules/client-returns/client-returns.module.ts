
import { Module } from '@nestjs/common';
import { ClientReturnsController } from './client-returns.controller';
import { ClientReturnsService } from './client-returns.service';
import { PrismaService } from '../../prisma.service';
 
@Module({
  controllers: [ClientReturnsController],
  providers: [ClientReturnsService, PrismaService],
  exports: [ClientReturnsService],
})
export class ClientReturnsModule {}