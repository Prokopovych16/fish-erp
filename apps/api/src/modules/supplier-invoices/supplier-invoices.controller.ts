import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards,
} from '@nestjs/common';
import { SupplierInvoicesService } from './supplier-invoices.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, Form } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('supplier-invoices')
export class SupplierInvoicesController {
  constructor(private service: SupplierInvoicesService) {}

  @Get()
  findAll(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('supplierId') supplierId?: string,
    @Query('form') form?: string,
  ) {
    return this.service.findAll({ from, to, supplierId, form });
  }

  @Get('registry')
  getRegistry(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('supplierId') supplierId?: string,
    @Query('form') form?: string,
  ) {
    return this.service.getRegistry({ from, to, supplierId, form });
  }

  @Get('budget')
  getBudget(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('form') form?: string,
  ) {
    return this.service.getBudget({ from, to, form });
  }

  @Get('settlements')
  getSettlements(@Query('from') from: string, @Query('to') to: string) {
    return this.service.getSettlements({ from, to });
  }

  @Post('payments')
  createPayment(
    @Body() dto: { supplierId: string; amount: number; note?: string; paymentDate: string },
    @Request() req,
  ) {
    return this.service.createPayment(dto, req.user.id);
  }

  @Delete('payments/:id')
  deletePayment(@Param('id') id: string) {
    return this.service.deletePayment(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(
    @Body() dto: {
      supplierId: string; invoiceNumber?: string; invoiceDate: string;
      warehouseId: string; form: Form; note?: string;
      items: { productId: string; quantity: number; pricePerKg: number; comment?: string }[];
    },
    @Request() req,
  ) {
    return this.service.create(dto, req.user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: Partial<{
      supplierId: string; invoiceNumber: string; invoiceDate: string;
      warehouseId: string; form: Form; note: string;
      items: { productId: string; quantity: number; pricePerKg: number; comment?: string }[];
    }>,
    @Request() req,
  ) {
    return this.service.update(id, dto, req.user.id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
