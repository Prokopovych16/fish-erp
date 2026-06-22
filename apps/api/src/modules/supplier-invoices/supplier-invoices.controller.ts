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
  findAll(@Query('from') from?: string, @Query('to') to?: string, @Query('supplierId') supplierId?: string) {
    return this.service.findAll({ from, to, supplierId });
  }

  @Get('registry')
  getRegistry(@Query('from') from: string, @Query('to') to: string, @Query('supplierId') supplierId?: string) {
    return this.service.getRegistry({ from, to, supplierId });
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
      items: { productId: string; quantity: number; pricePerKg: number }[];
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
      items: { productId: string; quantity: number; pricePerKg: number }[];
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
