import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Form } from '@prisma/client';

interface InvoiceItemDto {
  productId: string;
  quantity: number;
  pricePerKg: number; // з ПДВ
}

interface CreateInvoiceDto {
  supplierId: string;
  invoiceNumber?: string;
  invoiceDate: string;
  warehouseId: string;
  form: Form;
  note?: string;
  items: InvoiceItemDto[];
}

function r2(value: number): number {
  return Math.round(value * 100 + 1e-7) / 100;
}

function calcTotals(items: InvoiceItemDto[]) {
  const totalWithVat = items.reduce(
    (s, i) => s + r2(i.quantity * i.pricePerKg),
    0,
  );
  const totalNoVat = Number((totalWithVat / 1.2).toFixed(2));
  const vat = Number((totalWithVat - totalNoVat).toFixed(2));
  return { totalWithVat: Number(totalWithVat.toFixed(2)), totalNoVat, vat };
}

@Injectable()
export class SupplierInvoicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: { from?: string; to?: string; supplierId?: string }) {
    const where: any = {};
    if (params.supplierId) where.supplierId = params.supplierId;
    if (params.from || params.to) {
      where.invoiceDate = {
        ...(params.from && { gte: new Date(params.from) }),
        ...(params.to && { lte: new Date(new Date(params.to).setHours(23, 59, 59)) }),
      };
    }
    const invoices = await this.prisma.supplierInvoice.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        items: { include: { product: { select: { name: true, unit: true } } } },
      },
      orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
    });

    return invoices.map((inv) => {
      const totals = calcTotals(
        inv.items.map((i) => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          pricePerKg: Number(i.pricePerKg),
        })),
      );
      return { ...inv, ...totals };
    });
  }

  async findOne(id: string) {
    const invoice = await this.prisma.supplierInvoice.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        items: { include: { product: { select: { name: true, unit: true } } } },
      },
    });
    if (!invoice) throw new HttpException('Накладну не знайдено', HttpStatus.NOT_FOUND);
    return invoice;
  }

  async create(dto: CreateInvoiceDto, createdById: string) {
    if (!dto.items?.length) throw new HttpException('Додайте хоча б одну позицію', HttpStatus.BAD_REQUEST);

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.supplierInvoice.create({
        data: {
          supplierId: dto.supplierId,
          invoiceNumber: dto.invoiceNumber || null,
          invoiceDate: new Date(dto.invoiceDate),
          warehouseId: dto.warehouseId,
          form: dto.form,
          note: dto.note || null,
          createdById,
          items: {
            create: dto.items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              pricePerKg: i.pricePerKg,
            })),
          },
        },
        include: { items: true },
      });

      // Кожна позиція накладної — окрема партія на складі + рух
      for (const item of dto.items) {
        await tx.stockItem.create({
          data: {
            warehouseId: dto.warehouseId,
            productId: item.productId,
            form: dto.form,
            quantity: item.quantity,
            pricePerKg: item.pricePerKg,
            supplierId: dto.supplierId,
            invoiceId: invoice.id,
            arrivedAt: new Date(dto.invoiceDate),
          },
        });
        await tx.stockMovement.create({
          data: {
            warehouseId: dto.warehouseId,
            productId: item.productId,
            type: 'IN',
            quantity: item.quantity,
            form: dto.form,
            pricePerKg: item.pricePerKg,
            supplierId: dto.supplierId,
            invoiceId: invoice.id,
            note: dto.note || (dto.invoiceNumber ? `Накладна №${dto.invoiceNumber}` : undefined),
          },
        });
      }

      return invoice;
    });
  }

  async update(id: string, dto: Partial<CreateInvoiceDto>, _userId: string) {
    const existing = await this.findOneOrFail(id);

    return this.prisma.$transaction(async (tx) => {
      // Якщо змінюються позиції — повністю перестворюємо пов'язані StockItem/StockMovement
      if (dto.items) {
        await tx.stockItem.deleteMany({ where: { invoiceId: id } });
        await tx.stockMovement.deleteMany({ where: { invoiceId: id } });
        await tx.supplierInvoiceItem.deleteMany({ where: { invoiceId: id } });

        const warehouseId = dto.warehouseId ?? existing.warehouseId;
        const form = dto.form ?? existing.form;
        const supplierId = dto.supplierId ?? existing.supplierId;
        const invoiceDate = dto.invoiceDate ? new Date(dto.invoiceDate) : existing.invoiceDate;

        for (const item of dto.items) {
          await tx.supplierInvoiceItem.create({
            data: { invoiceId: id, productId: item.productId, quantity: item.quantity, pricePerKg: item.pricePerKg },
          });
          await tx.stockItem.create({
            data: {
              warehouseId, productId: item.productId, form,
              quantity: item.quantity, pricePerKg: item.pricePerKg,
              supplierId, invoiceId: id, arrivedAt: invoiceDate,
            },
          });
          await tx.stockMovement.create({
            data: {
              warehouseId, productId: item.productId, type: 'IN',
              quantity: item.quantity, form, pricePerKg: item.pricePerKg,
              supplierId, invoiceId: id,
            },
          });
        }
      }

      return tx.supplierInvoice.update({
        where: { id },
        data: {
          ...(dto.supplierId !== undefined && { supplierId: dto.supplierId }),
          ...(dto.invoiceNumber !== undefined && { invoiceNumber: dto.invoiceNumber || null }),
          ...(dto.invoiceDate !== undefined && { invoiceDate: new Date(dto.invoiceDate) }),
          ...(dto.warehouseId !== undefined && { warehouseId: dto.warehouseId }),
          ...(dto.form !== undefined && { form: dto.form }),
          ...(dto.note !== undefined && { note: dto.note || null }),
        },
        include: {
          supplier: { select: { id: true, name: true } },
          items: { include: { product: { select: { name: true, unit: true } } } },
        },
      });
    });
  }

  async delete(id: string) {
    await this.findOneOrFail(id);
    await this.prisma.$transaction([
      this.prisma.stockMovement.deleteMany({ where: { invoiceId: id } }),
      this.prisma.stockItem.deleteMany({ where: { invoiceId: id } }),
      this.prisma.supplierInvoice.delete({ where: { id } }),
    ]);
  }

  async getRegistry(params: { from: string; to: string; supplierId?: string }) {
    const where: any = {
      invoiceDate: {
        ...(params.from && { gte: new Date(params.from) }),
        ...(params.to && { lte: new Date(new Date(params.to).setHours(23, 59, 59)) }),
      },
      ...(params.supplierId && { supplierId: params.supplierId }),
    };

    const invoices = await this.prisma.supplierInvoice.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        items: { select: { quantity: true, pricePerKg: true } },
      },
      orderBy: [{ invoiceNumber: 'asc' }, { invoiceDate: 'asc' }],
    });

    const rows = invoices.map((inv) => {
      const totals = calcTotals(
        inv.items.map((i) => ({ productId: '', quantity: Number(i.quantity), pricePerKg: Number(i.pricePerKg) })),
      );
      return {
        number: inv.invoiceNumber ?? '—',
        supplier: inv.supplier.name,
        form: inv.form,
        totalNoVat: totals.totalNoVat,
        totalWithVat: totals.totalWithVat,
        vat: totals.vat,
        invoiceDate: inv.invoiceDate,
      };
    });

    const grandNoVat = Number(rows.reduce((s, r) => s + r.totalNoVat, 0).toFixed(2));
    const grandWithVat = Number(rows.reduce((s, r) => s + r.totalWithVat, 0).toFixed(2));
    const grandVat = Number((grandWithVat - grandNoVat).toFixed(2));

    return { rows, grandNoVat, grandWithVat, grandVat, from: params.from, to: params.to };
  }

  private async findOneOrFail(id: string) {
    const invoice = await this.prisma.supplierInvoice.findUnique({ where: { id } });
    if (!invoice) throw new HttpException('Накладну не знайдено', HttpStatus.NOT_FOUND);
    return invoice;
  }
}
