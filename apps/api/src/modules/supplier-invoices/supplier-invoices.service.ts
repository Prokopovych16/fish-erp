import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Form } from '@prisma/client';
import { r2 } from '../../utils/finance';

interface InvoiceItemDto {
  productId: string;
  quantity: number;
  pricePerKg: number; // з ПДВ
  comment?: string;
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

  async findAll(params: { from?: string; to?: string; supplierId?: string; form?: string }) {
    const where: any = {};
    if (params.supplierId) where.supplierId = params.supplierId;
    if (params.form) where.form = params.form;
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
              comment: i.comment || null,
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
            createdAt: new Date(dto.invoiceDate),
            note: item.comment || dto.note || (dto.invoiceNumber ? `Накладна №${dto.invoiceNumber}` : undefined),
          },
        });
      }

      return invoice;
    });
  }

  async update(id: string, dto: Partial<CreateInvoiceDto>, _userId: string) {
    const existing = await this.findOneOrFail(id);

    return this.prisma.$transaction(async (tx) => {
      // Якщо змінюються позиції — перевіряємо чи товар ще не використано
      if (dto.items) {
        const outMovements = await tx.stockMovement.count({
          where: { invoiceId: id, type: { not: 'IN' } },
        });
        // Також перевіряємо чи є OUT-рухи по складу після дати накладної
        const warehouseId = dto.warehouseId ?? existing.warehouseId;
        const productIds = dto.items.map((i) => i.productId);
        const outAfterInvoice = await tx.stockMovement.count({
          where: {
            warehouseId,
            productId: { in: productIds },
            type: 'OUT',
            createdAt: { gte: existing.invoiceDate },
          },
        });
        if (outMovements > 0 || outAfterInvoice > 0) {
          throw new HttpException(
            'Товари з цієї накладної вже були використані. Змінити позиції неможливо.',
            HttpStatus.CONFLICT,
          );
        }

        await tx.stockItem.deleteMany({ where: { invoiceId: id } });
        await tx.stockMovement.deleteMany({ where: { invoiceId: id } });
        await tx.supplierInvoiceItem.deleteMany({ where: { invoiceId: id } });

        const form = dto.form ?? existing.form;
        const supplierId = dto.supplierId ?? existing.supplierId;
        const invoiceDate = dto.invoiceDate ? new Date(dto.invoiceDate) : existing.invoiceDate;

        for (const item of dto.items) {
          await tx.supplierInvoiceItem.create({
            data: { invoiceId: id, productId: item.productId, quantity: item.quantity, pricePerKg: item.pricePerKg, comment: item.comment || null },
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
              createdAt: invoiceDate,
              note: item.comment || undefined,
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

  async getRegistry(params: { from: string; to: string; supplierId?: string; form?: string }) {
    const where: any = {
      invoiceDate: {
        ...(params.from && { gte: new Date(params.from) }),
        ...(params.to && { lte: new Date(new Date(params.to).setHours(23, 59, 59)) }),
      },
      ...(params.supplierId && { supplierId: params.supplierId }),
      ...(params.form && { form: params.form }),
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

  async getBudget(params: { from: string; to: string; form?: string }) {
    const dateFilter = {
      ...(params.from && { gte: new Date(params.from) }),
      ...(params.to && { lte: new Date(new Date(params.to).setHours(23, 59, 59)) }),
    };

    // Загальна закупівля — всі накладні постачальників
    const purchaseInvoices = await this.prisma.supplierInvoice.findMany({
      where: {
        invoiceDate: dateFilter,
        ...(params.form && { form: params.form as Form }),
      },
      include: { items: { select: { quantity: true, pricePerKg: true } } },
    });
    const totalPurchases = purchaseInvoices.reduce((sum, inv) => {
      const invTotal = inv.items.reduce((s, i) => s + r2(Number(i.quantity) * Number(i.pricePerKg)), 0);
      return sum + invTotal;
    }, 0);

    // Загальні продажі — виконані замовлення (за датою створення)
    const orders = await this.prisma.order.findMany({
      where: {
        status: 'DONE',
        createdAt: dateFilter,
        deletedAt: null,
        ...(params.form && { form: params.form as Form }),
      },
      include: { items: { select: { actualWeight: true, pricePerKg: true } } },
    });
    const totalSales = orders.reduce((sum, ord) => {
      const noVat = ord.items.reduce((s, i) => {
        if (!i.actualWeight) return s;
        return s + r2(Number(i.actualWeight) * Number(i.pricePerKg ?? 0));
      }, 0);
      return sum + r2(noVat * 1.2);
    }, 0);

    return {
      totalSales: r2(totalSales),
      totalPurchases: r2(totalPurchases),
      balance: r2(totalSales - totalPurchases),
      from: params.from,
      to: params.to,
      form: params.form || null,
    };
  }

  async getSettlements(params: { from: string; to: string }) {
    const FORM = 'FORM_1' as const;
    const dateStart = new Date(params.from);
    const dateEnd = new Date(new Date(params.to).setHours(23, 59, 59, 999));

    const suppliers = await this.prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        supplierInvoices: {
          where: { form: FORM },
          include: { items: { select: { quantity: true, pricePerKg: true } } },
        },
        payments: { orderBy: { paymentDate: 'asc' } },
      },
    });

    const results = suppliers.map((sup) => {
      const periodInvoices = sup.supplierInvoices.filter(
        (inv) => inv.invoiceDate >= dateStart && inv.invoiceDate <= dateEnd,
      );
      const periodPayments = sup.payments.filter(
        (p) => p.paymentDate >= dateStart && p.paymentDate <= dateEnd,
      );

      const calcInvoiceTotal = (inv: typeof sup.supplierInvoices[0]) =>
        inv.items.reduce((s, i) => s + r2(Number(i.quantity) * Number(i.pricePerKg)), 0);

      const periodInvoiced = r2(periodInvoices.reduce((s, inv) => s + calcInvoiceTotal(inv), 0));
      const periodAdjusted = r2(periodPayments.reduce((s, p) => s + Number(p.amount), 0));

      const allTimeInvoiced = sup.supplierInvoices.reduce((s, inv) => s + calcInvoiceTotal(inv), 0);
      const allTimeAdjusted = sup.payments.reduce((s, p) => s + Number(p.amount), 0);
      const balance = r2(allTimeInvoiced + allTimeAdjusted);

      const invoiceEvents = periodInvoices.map((inv) => ({
        type: 'invoice' as const,
        date: inv.invoiceDate.toISOString(),
        invoiceNumber: inv.invoiceNumber,
        amount: r2(calcInvoiceTotal(inv)),
        id: inv.id,
      }));
      const paymentEvents = periodPayments.map((p) => ({
        type: 'payment' as const,
        date: p.paymentDate.toISOString(),
        note: p.note,
        amount: Number(p.amount),
        id: p.id,
      }));
      const events = [...invoiceEvents, ...paymentEvents].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );

      return {
        supplier: { id: sup.id, name: sup.name, type: sup.type },
        periodInvoiced,
        periodAdjusted,
        balance,
        events,
      };
    });

    return results.filter((r) => r.events.length > 0 || r.balance !== 0);
  }

  async createPayment(dto: { supplierId: string; amount: number; note?: string; paymentDate: string }, userId: string) {
    return this.prisma.supplierPayment.create({
      data: {
        supplierId: dto.supplierId,
        amount: dto.amount,
        note: dto.note || null,
        paymentDate: new Date(dto.paymentDate),
        createdById: userId,
      },
    });
  }

  async deletePayment(id: string) {
    await this.prisma.supplierPayment.delete({ where: { id } });
  }

  private async findOneOrFail(id: string) {
    const invoice = await this.prisma.supplierInvoice.findUnique({ where: { id } });
    if (!invoice) throw new HttpException('Накладну не знайдено', HttpStatus.NOT_FOUND);
    return invoice;
  }
}
