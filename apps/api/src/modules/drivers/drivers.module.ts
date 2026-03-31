import { Module } from '@nestjs/common';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { CarsController } from './cars.controller';
import { CarsService } from './cars.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [DriversController, CarsController],
  providers: [DriversService, CarsService, PrismaService],
})
export class DriversModule {}
