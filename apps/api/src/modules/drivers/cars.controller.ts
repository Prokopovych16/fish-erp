import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { CarsService } from './cars.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('cars')
@UseGuards(JwtAuthGuard)
export class CarsController {
  constructor(private readonly carsService: CarsService) {}

  @Get() findAll() {
    return this.carsService.findAll();
  }
  @Post() create(@Body() dto: { number: string; brand?: string }) {
    return this.carsService.create(dto);
  }
  @Patch(':id') update(
    @Param('id') id: string,
    @Body() dto: { number?: string; brand?: string },
  ) {
    return this.carsService.update(id, dto);
  }
  @Patch(':id/toggle') toggle(@Param('id') id: string) {
    return this.carsService.toggle(id);
  }
}
