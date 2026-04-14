import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateItemsDto } from './dto/update-items.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { GetOrdersDto } from './dto/get-orders.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, Form } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  findActive(@Request() req, @Query('form') form?: Form) {
    return this.ordersService.findActive(req.user.id, req.user.role, form);
  }

  @Get('archive')
  findArchive(@Request() req, @Query() dto: GetOrdersDto) {
    return this.ordersService.findArchive(req.user.role, dto);
  }

  @Get('reports/registry')
  getRegistry(
    @Request() req,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('form') form?: string,
  ) {
    return this.ordersService.getRegistry(req.user.role, { from, to, form });
  }

  @Get('reports/suppliers')
  getSuppliersReport(
    @Request() req,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.ordersService.getSuppliersReport({ from, to });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.ordersService.findOne(id, req.user.role);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateOrderDto, @Request() req) {
    return this.ordersService.create(dto, req.user.id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  updateOrder(
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
    @Request() req,
  ) {
    return this.ordersService.updateOrder(id, dto, req.user.id, req.user.role);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @Request() req,
  ) {
    return this.ordersService.updateStatus(id, dto, req.user.id, req.user.role);
  }

  @Patch(':id/items')
  updateItems(
    @Param('id') id: string,
    @Body() dto: UpdateItemsDto,
    @Request() req,
  ) {
    return this.ordersService.updateItems(id, dto, req.user.role, req.user.id);
  }

  // Позначити як роздруковано
  @Patch(':id/printed')
  markPrinted(@Param('id') id: string, @Request() req) {
    return this.ordersService.markPrinted(id, req.user.role);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.ordersService.remove(id, req.user.role, req.user.id);
  }
}
