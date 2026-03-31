// apps/api/src/modules/client-returns/client-returns.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class ClientReturnsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: {
    clientId: string;
    deliveryPointId: string; // ← НОВЕ (обов'язкове)
    note?: string;
    items: {
      productId: string;
      totalQty: number;
      goodQty: number;
      warehouseId: string;
    }[];
  }) {
    const itemsWithWaste = dto.items.map((i) => ({
      ...i,
      wasteQty: i.totalQty - i.goodQty,
    }));

    const clientReturn = await this.prisma.clientReturn.create({
      data: {
        clientId: dto.clientId,
        deliveryPointId: dto.deliveryPointId, // ← НОВЕ
        note: dto.note,
        items: {
          create: itemsWithWaste.map((i) => ({
            productId: i.productId,
            totalQty: i.totalQty,
            goodQty: i.goodQty,
            wasteQty: i.wasteQty,
            warehouseId: i.warehouseId,
          })),
        },
      },
      include: {
        client: true,
        deliveryPoint: true, // ← НОВЕ
        items: { include: { product: true, warehouse: true } },
      },
    });

    for (const item of itemsWithWaste) {
      if (item.goodQty > 0) {
        await this.prisma.stockMovement.create({
          data: {
            warehouseId: item.warehouseId,
            productId: item.productId,
            type: 'IN',
            quantity: item.goodQty,
            form: 'FORM_1',
            note: `Повернення від клієнта — придатна продукція`,
          },
        });

        const existing = await this.prisma.stockItem.findFirst({
          where: {
            warehouseId: item.warehouseId,
            productId: item.productId,
            form: 'FORM_1',
          },
        });

        if (existing) {
          await this.prisma.stockItem.update({
            where: { id: existing.id },
            data: { quantity: { increment: item.goodQty } },
          });
        } else {
          await this.prisma.stockItem.create({
            data: {
              warehouseId: item.warehouseId,
              productId: item.productId,
              form: 'FORM_1',
              quantity: item.goodQty,
              arrivedAt: new Date(),
            },
          });
        }
      }

      // Утиль — тільки рух для логу, без впливу на залишки
      if (item.wasteQty > 0) {
        await this.prisma.stockMovement.create({
          data: {
            warehouseId: item.warehouseId,
            productId: item.productId,
            type: 'OUT',
            quantity: item.wasteQty,
            form: 'FORM_1',
            note: `Повернення від клієнта — утиль`,
          },
        });
      }
    }

    return clientReturn;
  }

  async findAll(params?: { clientId?: string; resolved?: boolean }) {
    return await this.prisma.clientReturn.findMany({
      where: {
        ...(params?.clientId && { clientId: params.clientId }),
        ...(params?.resolved !== undefined && {
          resolvedAt: params.resolved ? { not: null } : null,
        }),
      },
      include: {
        client: true,
        deliveryPoint: true, // ← НОВЕ
        items: { include: { product: true, warehouse: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingForClient(clientId: string) {
    return await this.prisma.clientReturn.findMany({
      where: { clientId, resolvedAt: null },
      include: {
        deliveryPoint: { select: { id: true, name: true } }, // ← НОВЕ
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ← НОВИЙ МЕТОД: повернення по конкретній точці доставки
  async getPendingForDeliveryPoint(deliveryPointId: string) {
    return await this.prisma.clientReturn.findMany({
      where: { deliveryPointId, resolvedAt: null },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, unit: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolve(id: string) {
    const ret = await this.prisma.clientReturn.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
      },
    });
    if (!ret) throw new NotFoundException('Повернення не знайдено');

    // Знаходимо склад готової продукції
    const finishedWarehouse = await this.prisma.warehouse.findFirst({
      where: { type: 'FINISHED_GOODS', isActive: true },
    });

    // Списуємо goodQty з FINISHED_GOODS по кожній позиції
    if (finishedWarehouse) {
      for (const item of ret.items) {
        const goodQty = Number(item.goodQty);
        if (goodQty <= 0) continue;

        // Перевіряємо залишок
        const batches = await this.prisma.stockItem.findMany({
          where: {
            warehouseId: finishedWarehouse.id,
            productId: item.productId,
            quantity: { gt: 0 },
          },
          orderBy: { arrivedAt: 'asc' },
        });

        const available = batches.reduce((s, b) => s + Number(b.quantity), 0);

        // Списуємо FIFO якщо є залишок, якщо немає — просто пишемо рух
        if (available > 0) {
          let remaining = Math.min(goodQty, available);
          for (const batch of batches) {
            if (remaining <= 0) break;
            const deduct = Math.min(Number(batch.quantity), remaining);
            await this.prisma.stockItem.update({
              where: { id: batch.id },
              data: { quantity: { decrement: deduct } },
            });
            remaining -= deduct;
          }
        }

        // Завжди пишемо рух для логу
        await this.prisma.stockMovement.create({
          data: {
            warehouseId: finishedWarehouse.id,
            productId: item.productId,
            type: 'OUT',
            quantity: goodQty,
            form: 'FORM_1',
            note: `Списання по поверненню від клієнта (враховано)`,
          },
        });
      }
    }

    return await this.prisma.clientReturn.update({
      where: { id },
      data: { resolvedAt: new Date() },
    });
  }

  async update(
    id: string,
    dto: {
      clientId?: string;
      deliveryPointId?: string;
      note?: string;
      resolvedAt?: string | null;
      items?: {
        id?: string;
        productId: string;
        totalQty: number;
        goodQty: number;
        wasteQty: number;
        warehouseId: string;
      }[];
    },
  ) {
    const existing = await this.prisma.clientReturn.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) throw new NotFoundException('Повернення не знайдено');

    // Оновлюємо головний запис
    const updated = await this.prisma.clientReturn.update({
      where: { id },
      data: {
        ...(dto.clientId && { clientId: dto.clientId }),
        ...(dto.deliveryPointId && { deliveryPointId: dto.deliveryPointId }),
        ...(dto.note !== undefined && { note: dto.note }),
        ...(dto.resolvedAt !== undefined && {
          resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt) : null,
        }),
      },
    });

    // Якщо передані позиції — оновлюємо
    if (dto.items) {
      // Видаляємо старі позиції
      await this.prisma.clientReturnItem.deleteMany({
        where: { returnId: id },
      });

      // Створюємо нові
      await this.prisma.clientReturnItem.createMany({
        data: dto.items.map((item) => ({
          returnId: id,
          productId: item.productId,
          totalQty: item.totalQty,
          goodQty: item.goodQty,
          wasteQty: item.totalQty - item.goodQty,
          warehouseId: item.warehouseId,
        })),
      });
    }

    return this.prisma.clientReturn.findUnique({
      where: { id },
      include: {
        client: true,
        deliveryPoint: true,
        items: { include: { product: true, warehouse: true } },
      },
    });
  }

  async remove(id: string) {
    return await this.prisma.clientReturn.delete({ where: { id } });
  }

  async processReturn(
    id: string,
    dto: {
      orderId: string;
      items: { returnItemId: string; actualQty: number }[];
    },
  ) {
    const ret = await this.prisma.clientReturn.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });
    if (!ret) throw new NotFoundException('Повернення не знайдено');

    const finishedWarehouse = await this.prisma.warehouse.findFirst({
      where: { type: 'FINISHED_GOODS', isActive: true },
    });
    if (!finishedWarehouse)
      throw new BadRequestException('Склад готової продукції не знайдено');

    // Списуємо з FINISHED_GOODS
    for (const dtoItem of dto.items) {
      if (dtoItem.actualQty <= 0) continue;

      const retItem = ret.items.find((i) => i.id === dtoItem.returnItemId);
      if (!retItem) continue;

      // OUT зі складу готової продукції
      await this.prisma.stockMovement.create({
        data: {
          warehouseId: finishedWarehouse.id,
          productId: retItem.productId,
          type: 'OUT',
          quantity: dtoItem.actualQty,
          form: 'FORM_1',
          note: `Списання по поверненню від клієнта`,
          orderId: dto.orderId,
        },
      });

      // Зменшуємо залишок
      const batches = await this.prisma.stockItem.findMany({
        where: {
          warehouseId: finishedWarehouse.id,
          productId: retItem.productId,
          quantity: { gt: 0 },
        },
        orderBy: { arrivedAt: 'asc' },
      });

      let remaining = dtoItem.actualQty;
      for (const batch of batches) {
        if (remaining <= 0) break;
        const deduct = Math.min(Number(batch.quantity), remaining);
        await this.prisma.stockItem.update({
          where: { id: batch.id },
          data: { quantity: { decrement: deduct } },
        });
        remaining -= deduct;
      }

      // Оновлюємо actualQty в ReturnItem
      await this.prisma.clientReturnItem.update({
        where: { id: dtoItem.returnItemId },
        data: { actualQty: dtoItem.actualQty },
      });
    }

    // Прив'язуємо до заявки і позначаємо враховане
    return this.prisma.clientReturn.update({
      where: { id },
      data: {
        orderId: dto.orderId,
        resolvedAt: new Date(),
      },
      include: {
        items: { include: { product: true } },
      },
    });
  }
}
