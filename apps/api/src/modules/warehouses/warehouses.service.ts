import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { StockMovementDto } from './dto/stock-movement.dto';
import { Form, MovementType } from '@prisma/client';

@Injectable()
export class WarehousesService {
  async findAllSuppliers() {
    return this.prisma.supplier.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createSupplier(dto: {
    name: string;
    edrpou?: string;
    contact?: string;
  }) {
    return this.prisma.supplier.create({ data: dto });
  }

  async updateSupplier(
    id: string,
    dto: { name?: string; edrpou?: string; contact?: string },
  ) {
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  async toggleSupplier(id: string) {
    const s = await this.prisma.supplier.findUniqueOrThrow({ where: { id } });
    return this.prisma.supplier.update({
      where: { id },
      data: { isActive: !s.isActive },
    });
  }
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getAllStock() {
    return this.prisma.warehouse.findMany({
      where: { isActive: true },
      include: {
        stockItems: {
          where: { quantity: { gt: 0 } }, // ← тільки позитивні залишки
          include: { product: true, supplier: true },
          orderBy: { arrivedAt: 'desc' },
        },
      },
    });
  }

  async getStock(warehouseId: string) {
    await this.findOneOrFail(warehouseId);
    return this.prisma.stockItem.findMany({
      where: { warehouseId },
      include: { product: true, supplier: true },
      orderBy: { arrivedAt: 'desc' },
    });
  }

  async create(dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({ data: dto });
  }

  async update(id: string, dto: UpdateWarehouseDto) {
    await this.findOneOrFail(id);
    return this.prisma.warehouse.update({ where: { id }, data: dto });
  }

  async toggle(id: string) {
    const warehouse = await this.findOneOrFail(id);
    return this.prisma.warehouse.update({
      where: { id },
      data: { isActive: !warehouse.isActive },
    });
  }

  async createMovement(dto: StockMovementDto, userId: string) {
    if (dto.type === MovementType.ADJUSTMENT && !dto.note) {
      throw new BadRequestException("Для ревізії обов'язковий коментар");
    }
    if (dto.type === MovementType.TRANSFER && !dto.toWarehouseId) {
      throw new BadRequestException(
        'Для переміщення вкажіть склад призначення',
      );
    }

    // Надходження тільки на FRIDGE
    if (dto.type === MovementType.IN) {
      const warehouse = await this.prisma.warehouse.findUnique({
        where: { id: dto.warehouseId },
      });
      if (warehouse?.type !== 'FRIDGE') {
        throw new BadRequestException(
          'Надходження товару можливе тільки на склад типу "Холодильник"',
        );
      }
    }

    // При переміщенні — підтягуємо форму і ціну з найстарішої партії (FIFO)
    let form: Form = dto.form ?? 'FORM_1';
    let transferPrice: number | null = null;
    let transferSupplierId: string | null = null;
    let transferStockItemId: string | null = null;

    if (dto.type === MovementType.TRANSFER) {
      const sourceStock = await this.prisma.stockItem.findFirst({
        where: {
          warehouseId: dto.warehouseId,
          productId: dto.productId,
          quantity: { gt: 0 },
        },
        orderBy: { arrivedAt: 'asc' }, // FIFO — найстаріша партія першою
      });
      if (sourceStock) {
        form = sourceStock.form;
        transferPrice = sourceStock.pricePerKg
          ? Number(sourceStock.pricePerKg)
          : null;
        transferSupplierId = sourceStock.supplierId ?? null;
        transferStockItemId = sourceStock.id;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Журнал руху
      await tx.stockMovement.create({
        data: {
          warehouseId: dto.warehouseId,
          productId: dto.productId,
          type: dto.type,
          quantity: dto.type === MovementType.IN ? dto.quantity : -dto.quantity,
          form,
          note: dto.note,
          supplierId:
            dto.type === MovementType.IN
              ? (dto.supplierId ?? null)
              : transferSupplierId,
        },
      });

      if (dto.type === MovementType.IN) {
        // FRIDGE — завжди створюємо нову партію
        await tx.stockItem.create({
          data: {
            warehouseId: dto.warehouseId,
            productId: dto.productId,
            form,
            quantity: dto.quantity,
            pricePerKg: dto.pricePerKg ?? null,
            supplierId: dto.supplierId ?? null,
            arrivedAt: new Date(),
          },
        });
      } else if (dto.type === MovementType.TRANSFER && transferStockItemId) {
        // Переміщення — списуємо з конкретної партії FIFO
        await tx.stockItem.update({
          where: { id: transferStockItemId },
          data: { quantity: { decrement: dto.quantity } },
        });

        // Журнал руху отримувача
        await tx.stockMovement.create({
          data: {
            warehouseId: dto.toWarehouseId!,
            productId: dto.productId,
            type: MovementType.TRANSFER,
            quantity: dto.quantity,
            form,
            note: dto.note,
            supplierId: transferSupplierId,
          },
        });

        // На складі отримувача — шукаємо чи є вже така партія
        // (той самий продукт + форма + постачальник + ціна)
        const destStock = await tx.stockItem.findFirst({
          where: {
            warehouseId: dto.toWarehouseId!,
            productId: dto.productId,
            form,
            pricePerKg: transferPrice ?? undefined,
            supplierId: transferSupplierId ?? undefined,
          },
        });

        if (destStock) {
          // Додаємо до існуючої партії
          await tx.stockItem.update({
            where: { id: destStock.id },
            data: { quantity: { increment: dto.quantity } },
          });
        } else {
          // Нова партія на складі отримувача
          await tx.stockItem.create({
            data: {
              warehouseId: dto.toWarehouseId!,
              productId: dto.productId,
              form,
              quantity: dto.quantity,
              pricePerKg: transferPrice,
              supplierId: transferSupplierId,
            },
          });
        }
      } else {
        // OUT / ADJUSTMENT — списуємо з найстаріших партій (FIFO)
        let remaining = dto.quantity;
        const batches = await tx.stockItem.findMany({
          where: {
            warehouseId: dto.warehouseId,
            productId: dto.productId,
            quantity: { gt: 0 },
          },
          orderBy: { arrivedAt: 'asc' },
        });

        for (const batch of batches) {
          if (remaining <= 0) break;
          const deduct = Math.min(Number(batch.quantity), remaining);
          await tx.stockItem.update({
            where: { id: batch.id },
            data: { quantity: { decrement: deduct } },
          });
          remaining -= deduct;
        }

        if (remaining > 0) {
          throw new BadRequestException(
            `Недостатньо товару на складі. Не вистачає ${remaining.toFixed(3)} кг`,
          );
        }
      }

      return { message: 'Рух товару зафіксовано' };
    });
  }

  async getMovements(warehouseId?: string, productId?: string) {
    return this.prisma.stockMovement.findMany({
      where: {
        ...(warehouseId && { warehouseId }),
        ...(productId && { productId }),
      },
      include: {
        warehouse: true,
        product: true,
        supplier: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private async findOneOrFail(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) throw new NotFoundException('Склад не знайдено');
    return warehouse;
  }

  async createProduction(dto: {
    inputs: {
      warehouseId: string;
      productId: string;
      quantity: number;
      form: string;
    }[];
    outputs: {
      productId: string;
      quantity: number;
      form: string;
      pricePerKg?: number;
    }[];
    note?: string;
  }) {
    const finishedWarehouse = await this.prisma.warehouse.findFirst({
      where: { type: 'FINISHED_GOODS', isActive: true },
    });

    if (!finishedWarehouse) {
      throw new BadRequestException(
        'Не знайдено склад готової продукції (FINISHED_GOODS)',
      );
    }

    // Перевіряємо наявність сировини
    for (const input of dto.inputs) {
      const batches = await this.prisma.stockItem.findMany({
        where: {
          warehouseId: input.warehouseId,
          productId: input.productId,
          form: input.form as any,
          quantity: { gt: 0 },
        },
        orderBy: { arrivedAt: 'asc' },
        include: { product: true },
      });

      const available = batches.reduce((s, b) => s + Number(b.quantity), 0);
      if (available < input.quantity) {
        const product =
          batches[0]?.product ??
          (await this.prisma.product.findUnique({
            where: { id: input.productId },
          }));
        throw new BadRequestException(
          `Недостатньо "${product?.name ?? input.productId}": є ${available.toFixed(3)} кг, треба ${input.quantity.toFixed(3)} кг`,
        );
      }
    }

    // Списуємо сировину по FIFO
    for (const input of dto.inputs) {
      const batches = await this.prisma.stockItem.findMany({
        where: {
          warehouseId: input.warehouseId,
          productId: input.productId,
          form: input.form as any,
          quantity: { gt: 0 },
        },
        orderBy: { arrivedAt: 'asc' },
      });

      let remaining = input.quantity;
      for (const batch of batches) {
        if (remaining <= 0) break;
        const deduct = Math.min(Number(batch.quantity), remaining);
        await this.prisma.stockItem.update({
          where: { id: batch.id },
          data: { quantity: { decrement: deduct } },
        });
        remaining -= deduct;
      }

      await this.prisma.stockMovement.create({
        data: {
          type: 'PRODUCTION',
          warehouseId: input.warehouseId,
          productId: input.productId,
          quantity: input.quantity,
          form: input.form as any,
          note: dto.note
            ? `[ВХІД] ${dto.note}`
            : '[ВХІД] Передано у виробництво',
        },
      });
    }

    // Додаємо готову продукцію на FINISHED_GOODS
    for (const output of dto.outputs) {
      await this.prisma.stockItem.create({
        data: {
          warehouseId: finishedWarehouse.id,
          productId: output.productId,
          form: output.form as any,
          quantity: output.quantity,
          pricePerKg: output.pricePerKg ?? null,
          arrivedAt: new Date(),
        },
      });

      await this.prisma.stockMovement.create({
        data: {
          type: 'PRODUCTION',
          warehouseId: finishedWarehouse.id,
          productId: output.productId,
          quantity: output.quantity,
          form: output.form as any,
          note: dto.note ? `[ВИХІД] ${dto.note}` : '[ВИХІД] Готова продукція',
        },
      });
    }

    return { success: true };
  }
}
