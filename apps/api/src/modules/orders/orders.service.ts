import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateItemsDto } from './dto/update-items.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { GetOrdersDto } from './dto/get-orders.dto';
import { OrderStatus, UserRole, Form } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findActive(userId: string, userRole: UserRole, form?: Form) {
    const where: any = {
      deletedAt: null,
      status: {
        in: [
          OrderStatus.PENDING,
          OrderStatus.IN_PROGRESS,
          OrderStatus.DONE,
          OrderStatus.DRAFT,
        ],
      },
    };

    if (userRole === UserRole.INSPECTOR) {
      where.form = Form.FORM_1;
    } else if (form) {
      where.form = form;
    }

    return this.prisma.order.findMany({
      where,
      include: {
        client: true,
        deliveryPoint: true,
        items: { include: { product: true } },
        createdBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findArchive(userRole: UserRole, dto: GetOrdersDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      status: { in: [OrderStatus.DONE, OrderStatus.CANCELLED] },
    };

    if (userRole === UserRole.INSPECTOR) {
      where.form = Form.FORM_1;
    } else if (dto.form) {
      where.form = dto.form;
    }

    if (dto.clientId) where.clientId = dto.clientId;
    if (dto.number) where.number = Number(dto.number);

    if (dto.from || dto.to) {
      where.createdAt = {
        ...(dto.from && { gte: new Date(dto.from) }),
        ...(dto.to && { lte: new Date(dto.to) }),
      };
    }

    const total = await this.prisma.order.count({ where });
    const orders = await this.prisma.order.findMany({
      where,
      include: {
        client: true,
        deliveryPoint: true,
        items: { include: { product: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    return {
      data: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, userRole: UserRole) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        client: true,
        deliveryPoint: true,
        items: { include: { product: true } },
        createdBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    if (!order || order.deletedAt)
      throw new NotFoundException('Заявку не знайдено');

    if (userRole === UserRole.INSPECTOR && order.form === Form.FORM_2) {
      throw new ForbiddenException('Недостатньо прав');
    }

    return order;
  }

  async create(dto: CreateOrderDto, userId: string) {
    const clientPrices = await this.prisma.clientPrice.findMany({
      where: { clientId: dto.clientId, form: dto.form },
    });
    const priceMap = new Map(clientPrices.map((p) => [p.productId, p.price]));

    // Визначаємо номер накладної
    let finalNumberForm: number;

    // Стало:
    if (dto.numberForm) {
      const duplicate = await this.prisma.order.findFirst({
        where: { form: dto.form, numberForm: dto.numberForm, deletedAt: null },
      });
      if (duplicate) {
        // ← Кидаємо помилку замість мовчазної заміни
        throw new BadRequestException(
          JSON.stringify({
            type: 'DUPLICATE_NUMBER',
            message: `Накладна №${dto.numberForm} вже існує для ${dto.form === 'FORM_1' ? 'Ф1' : 'Ф2'}`,
            numberForm: dto.numberForm,
            existingOrderId: duplicate.id,
          }),
        );
      }
      finalNumberForm = dto.numberForm;
    } else {
      // Беремо max тільки серед не-скасованих заявок
      const lastOrder = await this.prisma.order.findFirst({
        where: {
          form: dto.form,
          deletedAt: null,
          status: { not: OrderStatus.CANCELLED },
        },
        orderBy: { numberForm: 'desc' },
      });
      finalNumberForm = (lastOrder?.numberForm ?? 0) + 1;
      // Якщо цей номер вже зайнятий скасованою заявкою — пропускаємо далі
      let conflict = await this.prisma.order.findFirst({
        where: {
          form: dto.form,
          numberForm: finalNumberForm,
          deletedAt: null,
        },
      });
      while (conflict) {
        finalNumberForm++;
        conflict = await this.prisma.order.findFirst({
          where: {
            form: dto.form,
            numberForm: finalNumberForm,
            deletedAt: null,
          },
        });
      }
    }

    // Визначаємо статус — чернетка або звичайна
    const status = dto.status === 'DRAFT' ? 'DRAFT' : 'PENDING';

    const order = await this.prisma.order.create({
      data: {
        clientId: dto.clientId,
        form: dto.form,
        numberForm: finalNumberForm,
        status: status as any,
        createdById: userId,
        plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : null,
        invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : null,
        driverName: dto.driverName,
        carNumber: dto.carNumber,
        deliveryAddress: dto.deliveryAddress,
        deliveryPointId: dto.deliveryPointId ?? null,
        note: dto.note,
        items: {
          create: (dto.items ?? []).map((item) => ({
            productId: item.productId,
            plannedWeight: item.plannedWeight,
            pricePerKg: priceMap.get(item.productId) ?? null,
            displayUnit: item.displayUnit ?? null,
          })),
        },
      },
      include: {
        client: true,
        deliveryPoint: true,
        items: { include: { product: true } },
      },
    });

    await this.audit.log({
      userId,
      action: 'ORDER_CREATED',
      entityId: order.id,
      newValue: {
        number: order.numberForm,
        clientId: dto.clientId,
        form: dto.form,
        status,
        deliveryPointId: dto.deliveryPointId,
      },
    });

    return order;
  }

  async updateStatus(
    id: string,
    dto: UpdateStatusDto,
    userId: string,
    userRole: UserRole,
  ) {
    const order = await this.findOne(id, userRole);

    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      DRAFT: [OrderStatus.PENDING],
      PENDING: [
        OrderStatus.IN_PROGRESS,
        OrderStatus.CANCELLED,
        OrderStatus.DRAFT,
      ],
      IN_PROGRESS: [
        OrderStatus.DONE,
        OrderStatus.CANCELLED,
        OrderStatus.PENDING,
        OrderStatus.DRAFT,
      ],
      DONE: [OrderStatus.IN_PROGRESS], // тільки адмін
      CANCELLED: [],
    };

    if (!validTransitions[order.status].includes(dto.status)) {
      throw new BadRequestException(
        `Неможливо змінити статус з ${order.status} на ${dto.status}`,
      );
    }

    if (dto.status === OrderStatus.CANCELLED && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Тільки адмін може скасовувати заявки');
    }

    // ─── DONE → IN_PROGRESS: повернення товару ───────────────────────────────
    if (
      order.status === OrderStatus.DONE &&
      dto.status === OrderStatus.IN_PROGRESS
    ) {
      if (userRole !== UserRole.ADMIN) {
        throw new ForbiddenException(
          'Тільки адмін може повертати заявку з виконаних',
        );
      }

      const finishedWarehouse = await this.prisma.warehouse.findFirst({
        where: { type: 'FINISHED_GOODS', isActive: true },
      });

      if (finishedWarehouse) {
        for (const item of order.items) {
          const weight = Number(item.actualWeight ?? item.plannedWeight);
          if (weight <= 0) continue;

          await this.prisma.stockItem.create({
            data: {
              warehouseId: finishedWarehouse.id,
              productId: item.productId,
              form: order.form,
              quantity: weight,
              arrivedAt: new Date(),
            },
          });

          await this.prisma.stockMovement.create({
            data: {
              type: 'IN',
              warehouseId: finishedWarehouse.id,
              productId: item.productId,
              quantity: weight,
              form: order.form,
              note: `Повернення по заявці №${order.numberForm ?? order.number} (скасування виконання)`,
              orderId: order.id,
            },
          });
        }
      }

      const updated = await this.prisma.order.update({
        where: { id },
        data: {
          status: OrderStatus.IN_PROGRESS,
          completedAt: null,
          assignedToId: userId,
        },
        include: {
          client: true,
          deliveryPoint: true,
          items: { include: { product: true } },
        },
      });

      await this.audit.log({
        userId,
        action: 'ORDER_STATUS_CHANGED',
        entityId: id,
        oldValue: { status: order.status },
        newValue: {
          status: OrderStatus.IN_PROGRESS,
          reason: 'reverted_by_admin',
        },
      });

      return updated;
    }

    // ─── IN_PROGRESS → DONE: списання по FIFO ────────────────────────────────
    if (dto.status === OrderStatus.DONE) {
      // Перевірка що всі позиції мають фактичну вагу
      const missingWeights = order.items.filter(
        (item) => item.actualWeight === null || item.actualWeight === undefined,
      );
      if (missingWeights.length > 0) {
        throw new BadRequestException(
          'Вкажіть фактичну вагу для всіх позицій перед завершенням заявки',
        );
      }

      const finishedWarehouse = await this.prisma.warehouse.findFirst({
        where: { type: 'FINISHED_GOODS', isActive: true },
      });

      if (!finishedWarehouse) {
        throw new BadRequestException(
          'Не знайдено склад готової продукції. Створіть склад типу FINISHED_GOODS.',
        );
      }

      // Допоміжна функція: повертає партії продукту + взаємозамінних продуктів групи
      const getBatchesForItem = async (productId: string) => {
        const product = await this.prisma.product.findUnique({
          where: { id: productId },
          include: {
            group: {
              include: {
                products: {
                  where: { isActive: true },
                  select: { id: true, name: true },
                },
              },
            },
          },
        });

        // Збираємо productId-и для пошуку: сам продукт + інші з тієї ж групи
        const productIds = [productId];
        if (product?.group) {
          for (const p of product.group.products) {
            if (p.id !== productId) productIds.push(p.id);
          }
        }

        const batches = await this.prisma.stockItem.findMany({
          where: {
            warehouseId: finishedWarehouse.id,
            productId: { in: productIds },
            form: order.form,
            quantity: { gt: 0 },
          },
          include: { product: true },
          orderBy: { arrivedAt: 'asc' },
        });

        return { product, batches, productIds };
      };

      const shortages: {
        productName: string;
        needed: number;
        available: number;
      }[] = [];

      for (const item of order.items) {
        const weight = Number(item.actualWeight ?? item.plannedWeight);
        if (weight <= 0) continue;

        const { product, batches } = await getBatchesForItem(item.productId);
        const available = batches.reduce((s, b) => s + Number(b.quantity), 0);

        if (available < weight) {
          shortages.push({
            productName: product?.name ?? item.productId,
            needed: weight,
            available,
          });
        }
      }

      if (shortages.length > 0) {
        throw new BadRequestException(
          JSON.stringify({
            type: 'STOCK_SHORTAGE',
            message: 'Недостатньо товару на складі готової продукції',
            shortages,
            warehouseId: finishedWarehouse.id,
          }),
        );
      }

      for (const item of order.items) {
        const weight = Number(item.actualWeight ?? item.plannedWeight);
        if (weight <= 0) continue;

        const { batches } = await getBatchesForItem(item.productId);

        // Списуємо FIFO по батчах (може бути кілька продуктів однієї групи)
        // Відстежуємо скільки списано з кожного продукту для StockMovement
        const deductedByProduct: Map<string, number> = new Map();
        let remaining = weight;

        for (const batch of batches) {
          if (remaining <= 0) break;
          const deduct = Math.min(Number(batch.quantity), remaining);
          await this.prisma.stockItem.update({
            where: { id: batch.id },
            data: { quantity: { decrement: deduct } },
          });
          const prev = deductedByProduct.get(batch.productId) ?? 0;
          deductedByProduct.set(batch.productId, prev + deduct);
          remaining -= deduct;
        }

        // Створюємо StockMovement для кожного реально списаного продукту
        for (const [deductedProductId, deductedQty] of deductedByProduct.entries()) {
          const isSubstitute = deductedProductId !== item.productId;
          await this.prisma.stockMovement.create({
            data: {
              type: 'OUT',
              warehouseId: finishedWarehouse.id,
              productId: deductedProductId,
              quantity: deductedQty,
              form: order.form,
              note: isSubstitute
                ? `Списано (замість ${item.productId}) по заявці №${order.numberForm ?? order.number}`
                : `Списано по заявці №${order.numberForm ?? order.number}`,
              orderId: order.id,
            },
          });
        }
      }
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: dto.status,
        assignedToId:
          dto.status === OrderStatus.IN_PROGRESS ? userId : undefined,
        completedAt: dto.status === OrderStatus.DONE ? new Date() : undefined,
      },
      include: {
        client: true,
        deliveryPoint: true,
        items: { include: { product: true } },
      },
    });

    await this.audit.log({
      userId,
      action: 'ORDER_STATUS_CHANGED',
      entityId: id,
      oldValue: { status: order.status },
      newValue: { status: dto.status },
    });

    return updated;
  }

  async updateItems(
    id: string,
    dto: UpdateItemsDto,
    userRole: UserRole,
    userId: string,
  ) {
    const order = await this.findOne(id, userRole);

    if (
      order.status !== OrderStatus.IN_PROGRESS &&
      userRole !== UserRole.ADMIN
    ) {
      throw new BadRequestException(
        'Фактичну вагу можна вписати тільки для заявки в роботі',
      );
    }

    const oldItems = order.items.map((i) => ({
      id: i.id,
      actualWeight: i.actualWeight,
    }));

    const updates = dto.items.map((item) =>
      this.prisma.orderItem.update({
        where: { id: item.itemId },
        data: { actualWeight: item.actualWeight },
      }),
    );

    await this.prisma.$transaction(updates);

    await this.audit.log({
      userId,
      action: 'ORDER_ITEMS_UPDATED',
      entityId: id,
      oldValue: { items: oldItems },
      newValue: { items: dto.items },
    });

    return this.findOne(id, userRole);
  }

  async updateOrder(
    id: string,
    dto: UpdateOrderDto,
    userId: string,
    userRole: UserRole,
  ) {
    const order = await this.findOne(id, userRole);

    // numberForm — перевірка дублікату (виключаємо поточну заявку)
    if (dto.numberForm !== undefined && dto.numberForm !== order.numberForm) {
      const duplicate = await this.prisma.order.findFirst({
        where: {
          form: order.form,
          numberForm: dto.numberForm,
          deletedAt: null,
          id: { not: id },
        },
      });
      if (duplicate) {
        throw new BadRequestException(
          JSON.stringify({
            type: 'DUPLICATE_NUMBER',
            message: `Накладна №${dto.numberForm} вже існує для ${order.form === 'FORM_1' ? 'Ф1' : 'Ф2'}`,
            numberForm: dto.numberForm,
            existingOrderId: duplicate.id,
          }),
        );
      }
    }

    // Позиції — тільки якщо заявка не DONE
    if (dto.items !== undefined) {
      if (order.status === OrderStatus.DONE) {
        throw new BadRequestException(
          'Не можна змінити позиції у виконаній заявці. Поверніть заявку до "В роботі" спочатку.',
        );
      }

      const clientId = dto.clientId ?? order.clientId;
      const clientPrices = await this.prisma.clientPrice.findMany({
        where: { clientId, form: order.form },
      });
      const priceMap = new Map(clientPrices.map((p) => [p.productId, p.price]));

      await this.prisma.orderItem.deleteMany({ where: { orderId: id } });
      await this.prisma.orderItem.createMany({
        data: dto.items.map((item) => ({
          orderId: id,
          productId: item.productId,
          plannedWeight: item.plannedWeight,
          actualWeight: item.actualWeight ?? null,
          pricePerKg: priceMap.get(item.productId) ?? null,
          displayUnit: item.displayUnit ?? null,
        })),
      });
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        ...(dto.clientId && { clientId: dto.clientId }),
        ...(dto.numberForm !== undefined && { numberForm: dto.numberForm }),
        ...(dto.driverName !== undefined && {
          driverName: dto.driverName || null,
        }),
        ...(dto.carNumber !== undefined && {
          carNumber: dto.carNumber || null,
        }),
        ...(dto.deliveryAddress !== undefined && {
          deliveryAddress: dto.deliveryAddress || null,
        }),
        ...(dto.deliveryPointId !== undefined && {
          deliveryPointId: dto.deliveryPointId || null,
        }),
        ...(dto.note !== undefined && { note: dto.note || null }),
        ...(dto.plannedDate !== undefined && {
          plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : null,
        }),
        ...(dto.invoiceDate !== undefined && {
          invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : null,
        }),
      },
      include: {
        client: true,
        deliveryPoint: true,
        items: { include: { product: true } },
        createdBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      userId,
      action: 'ORDER_UPDATED',
      entityId: id,
      oldValue: {
        numberForm: order.numberForm,
        clientId: order.clientId,
        driverName: order.driverName,
        carNumber: order.carNumber,
      },
      newValue: dto,
    });

    return updated;
  }

  async remove(id: string, userRole: UserRole, userId: string) {
    const order = await this.findOne(id, userRole);

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'Можна видалити тільки заявку зі статусом "Очікує"',
      );
    }

    const deleted = await this.prisma.order.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId,
      action: 'ORDER_DELETED',
      entityId: id,
      oldValue: {
        number: order.numberForm ?? order.number,
        clientId: order.clientId,
      },
    });

    return deleted;
  }

  async markPrinted(id: string, userRole: UserRole) {
    const order = await this.findOne(id, userRole);

    if (!order.printedAt) {
      return this.prisma.order.update({
        where: { id },
        data: { printedAt: new Date() },
      });
    }

    return order;
  }

  async getRegistry(
    userRole: UserRole,
    params: { from: string; to: string; form?: string },
  ) {
    const where: any = {
      deletedAt: null,
      status: 'DONE',
      ...(params.form && { form: params.form as Form }),
      ...(userRole === UserRole.INSPECTOR && { form: Form.FORM_1 }),
      createdAt: {
        ...(params.from && { gte: new Date(params.from) }),
        ...(params.to && {
          lte: new Date(new Date(params.to).setHours(23, 59, 59)),
        }),
      },
    };

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        client: { select: { name: true } },
        deliveryPoint: { select: { name: true } },
        items: {
          select: {
            actualWeight: true,
            plannedWeight: true,
            pricePerKg: true,
            product: { select: { unit: true } },
          },
        },
      },
      orderBy: { completedAt: 'asc' },
    });

    const rows = orders.map((o) => {
      const total = o.items.reduce((s, i) => {
        // шт-товар без фактичної ваги — не рахуємо
        if (i.product.unit === 'шт' && !i.actualWeight) return s;
        return (
          s +
          Number(i.actualWeight ?? i.plannedWeight) * Number(i.pricePerKg ?? 0)
        );
      }, 0);
      return {
        number: (o as any).numberForm ?? o.number,
        client: o.client.name,
        deliveryPoint: o.deliveryPoint?.name ?? '',
        form: o.form,
        total: total,
        date: o.completedAt ?? o.createdAt,
      };
    });

    const grandTotal = rows.reduce((s, r) => s + r.total, 0);

    return {
      rows,
      grandTotal,
      from: params.from,
      to: params.to,
      form: params.form,
    };
  }

  async getSuppliersReport(params: { from: string; to: string }) {
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        type: 'IN',
        supplierId: { not: null },
        createdAt: {
          ...(params.from && { gte: new Date(params.from) }),
          ...(params.to && {
            lte: new Date(new Date(params.to).setHours(23, 59, 59)),
          }),
        },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        product: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Групуємо по постачальнику
    const suppliersMap = new Map<
      string,
      {
        id: string;
        name: string;
        items: {
          productName: string;
          qty: number;
          pricePerKg: number;
          total: number;
          date: Date;
        }[];
        total: number;
      }
    >();

    for (const m of movements) {
      if (!m.supplier) continue;
      if (!suppliersMap.has(m.supplier.id)) {
        suppliersMap.set(m.supplier.id, {
          id: m.supplier.id,
          name: m.supplier.name,
          items: [],
          total: 0,
        });
      }
      const entry = suppliersMap.get(m.supplier.id)!;
      // Знаходимо ціну з StockItem
      const stockItem = await this.prisma.stockItem.findFirst({
        where: { productId: m.productId, supplierId: m.supplierId! },
        orderBy: { arrivedAt: 'desc' },
      });
      const pricePerKg = Number(stockItem?.pricePerKg ?? 0);
      const qty = Number(m.quantity);
      const total = qty * pricePerKg;

      entry.items.push({
        productName: m.product.name,
        qty,
        pricePerKg,
        total,
        date: m.createdAt,
      });
      entry.total += total;
    }

    const suppliers = Array.from(suppliersMap.values()).sort(
      (a, b) => b.total - a.total,
    );

    const grandTotal = suppliers.reduce((s, sup) => s + sup.total, 0);

    return { suppliers, grandTotal, from: params.from, to: params.to };
  }
}
