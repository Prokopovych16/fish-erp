import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { DriversService } from './drivers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('drivers')
@UseGuards(JwtAuthGuard)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get() findAll() {
    return this.driversService.findAll();
  }
  @Post() create(@Body() dto: { name: string }) {
    return this.driversService.create(dto);
  }
  @Patch(':id') update(
    @Param('id') id: string,
    @Body() dto: { name?: string },
  ) {
    return this.driversService.update(id, dto);
  }
  @Patch(':id/toggle') toggle(@Param('id') id: string) {
    return this.driversService.toggle(id);
  }
}
