import { Module } from '@nestjs/common';
import { BazaarAssortmentController } from './bazaar-assortment.controller';
import { BazaarAssortmentService } from './bazaar-assortment.service';
import { PrismaModule } from '../../prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BazaarAssortmentController],
  providers: [BazaarAssortmentService],
})
export class BazaarAssortmentModule {}
