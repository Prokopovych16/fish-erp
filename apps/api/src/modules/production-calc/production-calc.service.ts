/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class ProductionCalcService {
  constructor(private prisma: PrismaService) {}

  async create(dto: {
    inputs: {
      productName: string;
      quantity: number;
      pricePerKg: number;
      form: string;
      supplierName?: string | null;  // ← додано
    }[];
    outputs: {
      productName: string;
      quantity: number;
      form: string;
      markupPct?: number;
    }[];
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

  async remove(id: string) {
    return await this.prisma.productionCalc.delete({ where: { id } });
  }
}