/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

type ProductionInput = {
  warehouseId: string;
  productId: string;
  quantity: number;
  form: string;
  stockItemId?: string;
};

type ProductionOutput = {
  productId: string;
  quantity: number;
  form: string;
  pricePerKg?: number;
};

type CalcInput = {
  productName: string;
  quantity: number;
  pricePerKg: number;
  form: string;
  supplierName?: string | null;
};

type CalcOutput = {
  productName: string;
  quantity: number;
  form: string;
  markupPct?: number;
};

@Injectable()
export class ProductionCalcService {
  constructor(private prisma: PrismaService) {}

  async create(dto: {
    inputs: CalcInput[];
    outputs: CalcOutput[];
    note?: string;
  }) {
    const totalInputCost = dto.inputs.reduce(
      (s, i) => s + i.quantity * i.pricePerKg,
      0,
    );
    const totalOutputQty = dto.outputs.reduce((s, o) => s + o.quantity, 0);
    const costPerKg = totalOutputQty > 0 ? totalInputCost / totalOutputQty : 0;

    return await this.prisma.productionCalc.create({
      data: {
        note: dto.note,
        totalInputCost,
        totalOutputQty,
        costPerKg,
        inputs: {
          create: dto.inputs.map((i) => ({
            productName: i.productName,
            quantity: i.quantity,
            pricePerKg: i.pricePerKg,
            totalCost: i.quantity * i.pricePerKg,
            form: i.form as any,
            supplierName: i.supplierName ?? null,
          })),
        },
        outputs: {
          create: dto.outputs.map((o) => {
            const markup = o.markupPct ?? 0;
            const salePrice = costPerKg * (1 + markup / 100);
            const margin = (salePrice - costPerKg) * o.quantity;
            return {
              productName: o.productName,
              quantity: o.quantity,
              costPerKg,
              form: o.form as any,
              markupPct: markup,
              salePricePerKg: salePrice,
              margin,
            };
          }),
        },
      },
      include: {
        inputs: true,
        outputs: true,
      },
    });
  }

  async findAll() {
    return await this.prisma.productionCalc.findMany({
      include: { inputs: true, outputs: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateMarkup(outputId: string, markupPct: number) {
    const output = await this.prisma.productionCalcOutput.findUnique({
      where: { id: outputId },
    });

    if (!output) throw new NotFoundException('Запис не знайдено');

    const costPerKg = Number(output.costPerKg);
    const salePrice = costPerKg * (1 + markupPct / 100);
    const margin = (salePrice - costPerKg) * Number(output.quantity);

    return await this.prisma.productionCalcOutput.update({
      where: { id: outputId },
      data: { markupPct, salePricePerKg: salePrice, margin },
    });
  }

  // ─── Оновлення calc + коригування складу ──────────────────────────────────
  async update(
    id: string,
    dto: {
      // Дані для складу (повторне виробництво)
      inputs: ProductionInput[];
      outputs: ProductionOutput[];
      // Дані для калькулятора
      calcInputs: CalcInput[];
      calcOutputs: CalcOutput[];
      note?: string;
    },
  ) {
    const calc = await this.prisma.productionCalc.findUnique({ where: { id } });
    if (!calc) throw new NotFoundException('Розрахунок не знайдено');

    // ── 1. Знаходимо старі рухи, прив'язані до цього calc ──────────────────
    const oldMovements = await this.prisma.stockMovement.findMany({
      where: { productionCalcId: id, type: 'PRODUCTION' },
      include: { warehouse: true },
    });

    if (oldMovements.length > 0) {
      // ── 2. Реверс старого виробництва ───────────────────────────────────
      const finishedWarehouse = await this.prisma.warehouse.findFirst({
        where: { type: 'FINISHED_GOODS', isActive: true },
      });

      for (const mv of oldMovements) {
        const note = mv.note ?? '';
        if (note.startsWith('[ВХІД]')) {
          // Відновлюємо сировину: знаходимо будь-яку партію з тим же warehouseId+productId+form
          const batch = await this.prisma.stockItem.findFirst({
            where: {
              warehouseId: mv.warehouseId,
              productId: mv.productId,
              form: mv.form,
            },
            orderBy: { arrivedAt: 'desc' },
          });
          if (batch) {
            await this.prisma.stockItem.update({
              where: { id: batch.id },
              data: { quantity: { increment: Number(mv.quantity) } },
            });
          } else {
            // Якщо партії немає — створюємо нову
            await this.prisma.stockItem.create({
              data: {
                warehouseId: mv.warehouseId,
                productId: mv.productId,
                form: mv.form,
                quantity: Number(mv.quantity),
                arrivedAt: new Date(),
              },
            });
          }
        } else if (note.startsWith('[ВИХІД]') && finishedWarehouse) {
          // Знімаємо готову продукцію: декрементуємо або видаляємо останню партію
          const batch = await this.prisma.stockItem.findFirst({
            where: {
              warehouseId: mv.warehouseId,
              productId: mv.productId,
              form: mv.form,
              quantity: { gt: 0 },
            },
            orderBy: { arrivedAt: 'desc' },
          });
          if (batch) {
            const newQty = Number(batch.quantity) - Number(mv.quantity);
            if (newQty <= 0) {
              await this.prisma.stockItem.delete({ where: { id: batch.id } });
            } else {
              await this.prisma.stockItem.update({
                where: { id: batch.id },
                data: { quantity: newQty },
              });
            }
          }
        }

        // Видаляємо старий рух
        await this.prisma.stockMovement.delete({ where: { id: mv.id } });
      }
    }

    // ── 3. Знаходимо FINISHED_GOODS склад для нового виробництва ────────────
    const finishedWarehouse = await this.prisma.warehouse.findFirstOrThrow({
      where: { type: 'FINISHED_GOODS', isActive: true },
    });

    // ── 4. Собівартість для нового виробництва ──────────────────────────────
    const totalInputCost = dto.calcInputs.reduce(
      (s, i) => s + i.quantity * i.pricePerKg,
      0,
    );
    const totalOutputQty = dto.calcOutputs.reduce((s, o) => s + o.quantity, 0);
    const costPerKg = totalOutputQty > 0 ? totalInputCost / totalOutputQty : 0;

    // ── 5. Збираємо supplierId з першої вхідної партії ──────────────────────
    let productionSupplierId: string | null = null;
    for (const input of dto.inputs) {
      if (productionSupplierId) break;
      if (input.stockItemId) {
        const item = await this.prisma.stockItem.findUnique({
          where: { id: input.stockItemId },
          select: { supplierId: true },
        });
        productionSupplierId = item?.supplierId ?? null;
      } else {
        const batch = await this.prisma.stockItem.findFirst({
          where: {
            warehouseId: input.warehouseId,
            productId: input.productId,
            form: input.form as any,
            quantity: { gt: 0 },
          },
          orderBy: { arrivedAt: 'asc' },
          select: { supplierId: true },
        });
        productionSupplierId = batch?.supplierId ?? null;
      }
    }

    // ── 6. Застосовуємо нове виробництво ────────────────────────────────────
    for (const input of dto.inputs) {
      if (input.stockItemId) {
        await this.prisma.stockItem.update({
          where: { id: input.stockItemId },
          data: { quantity: { decrement: input.quantity } },
        });
      } else {
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
      }

      await this.prisma.stockMovement.create({
        data: {
          type: 'PRODUCTION',
          warehouseId: input.warehouseId,
          productId: input.productId,
          quantity: input.quantity,
          form: input.form as any,
          note: dto.note ? `[ВХІД] ${dto.note}` : '[ВХІД] Передано у виробництво',
          productionCalcId: id,
        },
      });
    }

    for (const output of dto.outputs) {
      await this.prisma.stockItem.create({
        data: {
          warehouseId: finishedWarehouse.id,
          productId: output.productId,
          form: output.form as any,
          quantity: output.quantity,
          pricePerKg: output.pricePerKg ?? costPerKg,
          supplierId: productionSupplierId,
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
          supplierId: productionSupplierId,
          pricePerKg: output.pricePerKg ?? costPerKg,
          productionCalcId: id,
        },
      });
    }

    // ── 7. Оновлюємо calc record ─────────────────────────────────────────────
    await this.prisma.productionCalcInput.deleteMany({ where: { calcId: id } });
    await this.prisma.productionCalcOutput.deleteMany({ where: { calcId: id } });

    return await this.prisma.productionCalc.update({
      where: { id },
      data: {
        note: dto.note ?? null,
        totalInputCost,
        totalOutputQty,
        costPerKg,
        inputs: {
          create: dto.calcInputs.map((i) => ({
            productName: i.productName,
            quantity: i.quantity,
            pricePerKg: i.pricePerKg,
            totalCost: i.quantity * i.pricePerKg,
            form: i.form as any,
            supplierName: i.supplierName ?? null,
          })),
        },
        outputs: {
          create: dto.calcOutputs.map((o) => {
            const markup = o.markupPct ?? 0;
            const salePrice = costPerKg * (1 + markup / 100);
            const margin = (salePrice - costPerKg) * o.quantity;
            return {
              productName: o.productName,
              quantity: o.quantity,
              costPerKg,
              form: o.form as any,
              markupPct: markup,
              salePricePerKg: salePrice,
              margin,
            };
          }),
        },
      },
      include: { inputs: true, outputs: true },
    });
  }

  async remove(id: string) {
    return await this.prisma.productionCalc.delete({ where: { id } });
  }
}
