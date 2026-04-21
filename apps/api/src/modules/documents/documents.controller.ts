import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { DocumentsService } from './documents.service';
import { OrdersService } from '../orders/orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('documents')
export class DocumentsController {
  constructor(
    private documentsService: DocumentsService,
    private ordersService: OrdersService, // ← НОВЕ
  ) {}

  @Get('order/:id/ttn')
  async getTTN(@Param('id') id: string, @Res() res: Response) {
    const pdf = await this.documentsService.generateTTN(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="ttn-${id}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }

  @Get('order/:id/quality')
  async getQuality(@Param('id') id: string, @Res() res: Response) {
    const pdf = await this.documentsService.generateQuality(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="quality-${id}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }

  @Get('order/:id/invoice')
  async getInvoice(@Param('id') id: string, @Res() res: Response) {
    const pdf = await this.documentsService.generateInvoice(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${id}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }

  @Get('order/:id/all')
  async getAll(@Param('id') id: string, @Res() res: Response) {
    const pdf = await this.documentsService.generateAll(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="all-docs-${id}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }

  @Get('client/:clientId/pricelist')
  async getPriceList(
    @Param('clientId') clientId: string,
    @Query('form') form: string = 'FORM_1',
    @Res() res: Response,
  ) {
    const pdf = await this.documentsService.generatePriceList(clientId, form);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="pricelist-${clientId}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }

  // ← НОВЕ: Реєстр накладних
  @Get('reports/registry')
  async getRegistry(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('form') form: string,
    @Res() res: Response,
  ) {
    const data = await this.ordersService.getRegistry(UserRole.ADMIN, {
      from,
      to,
      form,
    });
    const pdf = await this.documentsService.generateRegistry(data);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="registry-${from}-${to}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }

  // ← НОВЕ: Звіт по постачальниках
  @Get('reports/suppliers')
  async getSuppliersReport(
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const data = await this.ordersService.getSuppliersReport({ from, to });
    const pdf = await this.documentsService.generateSuppliersReport(data);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="suppliers-${from}-${to}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }
}
