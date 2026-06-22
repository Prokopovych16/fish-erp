import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ForecastService } from './forecast.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('forecast')
export class ForecastController {
  constructor(private forecastService: ForecastService) {}

  @Get()
  getForecast(@Query('weeks') weeks?: string) {
    return this.forecastService.getForecast(weeks ? Number(weeks) : undefined);
  }
}
