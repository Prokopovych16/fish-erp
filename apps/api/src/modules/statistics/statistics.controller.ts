import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, Form } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ACCOUNTANT) // INSPECTOR не має доступу
@Controller('statistics')
export class StatisticsController {
  constructor(private statisticsService: StatisticsService) {}

  // GET /api/statistics/dashboard?from=2026-01-01&to=2026-03-01&form=FORM_1
  @Get('dashboard')
  getDashboard(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('form') form?: Form,
  ) {
    return this.statisticsService.getDashboard(from, to, form);
  }

  // GET /api/statistics/finance
  @Get('finance')
  getFinance(@Query('from') from?: string, @Query('to') to?: string) {
    return this.statisticsService.getRevenueByForm(from, to);
  }

  // GET /api/statistics/orders
  @Get('orders')
  getOrders(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('form') form?: Form,
  ) {
    return this.statisticsService.getOrdersStats(from, to, form);
  }

  // GET /api/statistics/clients
  @Get('clients')
  getClients(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('form') form?: Form,
  ) {
    return this.statisticsService.getTopClients(from, to, form);
  }

  // GET /api/statistics/products
  @Get('products')
  getProducts(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('form') form?: Form,
  ) {
    return this.statisticsService.getProductsStats(from, to, form);
  }

  // GET /api/statistics/workers
  @Get('workers')
  getWorkers(@Query('from') from?: string, @Query('to') to?: string) {
    return this.statisticsService.getWorkersStats(from, to);
  }

  // GET /api/statistics/chart
  @Get('chart')
  getChart(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('form') form?: Form,
  ) {
    return this.statisticsService.getOrdersChart(from, to, form);
  }

  @Get('production')
  getProduction(@Query() params: { from: string; to: string }) {
    return this.statisticsService.getProduction(params.from, params.to);
  }
}
