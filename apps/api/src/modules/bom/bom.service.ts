import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class BomService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.productBOM.findMany({
      include: {
        outputProduct: { select: { id: true, name: true, unit: true } },
        inputProduct: { select: { id: true, name: true, unit: true } },
      },
      orderBy: [{ outputProduct: { name: 'asc' } }],
    });
  }

  async create(dto: { outputProductId: string; inputProductId: string; yieldPct: number; leadDays?: number; note?: string }) {
    if (dto.outputProductId === dto.inputProductId) {
      throw new ConflictException('Товар не може бути зроблений із самого себе');
    }
    try {
      return await this.prisma.productBOM.create({
        data: {
          outputProductId: dto.outputProductId,
          inputProductId: dto.inputProductId,
          yieldPct: dto.yieldPct,
          leadDays: dto.leadDays ?? 0,
          note: dto.note,
        },
        include: {
          outputProduct: { select: { id: true, name: true, unit: true } },
          inputProduct: { select: { id: true, name: true, unit: true } },
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException('Такий зв\'язок уже існує');
      }
      throw e;
    }
  }

  update(id: string, dto: { yieldPct?: number; leadDays?: number; note?: string }) {
    return this.prisma.productBOM.update({
      where: { id },
      data: dto,
      include: {
        outputProduct: { select: { id: true, name: true, unit: true } },
        inputProduct: { select: { id: true, name: true, unit: true } },
      },
    });
  }

  delete(id: string) {
    return this.prisma.productBOM.delete({ where: { id } });
  }
}
