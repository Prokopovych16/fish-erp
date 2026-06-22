import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class RecipesService {
  constructor(private prisma: PrismaService) {}

  async findAllSheets() {
    return this.prisma.recipeSheet.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { stages: true } } },
    });
  }

  async findOneSheet(id: string) {
    const sheet = await this.prisma.recipeSheet.findUnique({
      where: { id },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!sheet) throw new HttpException('Рецептуру не знайдено', HttpStatus.NOT_FOUND);
    return sheet;
  }

  async createSheet(dto: { name: string; icon?: string; description?: string }) {
    const maxOrder = await this.prisma.recipeSheet.aggregate({ _max: { sortOrder: true } });
    return this.prisma.recipeSheet.create({
      data: {
        name: dto.name,
        icon: dto.icon || '🐟',
        description: dto.description || null,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
  }

  async updateSheet(id: string, dto: { name?: string; icon?: string; description?: string }) {
    await this.findOneSheet(id);
    return this.prisma.recipeSheet.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.description !== undefined && { description: dto.description || null }),
      },
    });
  }

  async deleteSheet(id: string) {
    await this.findOneSheet(id);
    await this.prisma.recipeSheet.delete({ where: { id } });
  }

  async reorderSheets(orderedIds: string[]) {
    await this.prisma.$transaction(
      orderedIds.map((id, idx) =>
        this.prisma.recipeSheet.update({ where: { id }, data: { sortOrder: idx } }),
      ),
    );
  }

  async createStage(sheetId: string, dto: {
    name: string; content?: string; tempInfo?: string; timeInfo?: string; isCriticalPoint?: boolean;
    ingredients?: { name: string; amount: string }[];
  }) {
    await this.findOneSheet(sheetId);
    const maxOrder = await this.prisma.recipeStage.aggregate({
      where: { recipeSheetId: sheetId },
      _max: { sortOrder: true },
    });
    return this.prisma.recipeStage.create({
      data: {
        recipeSheetId: sheetId,
        name: dto.name,
        content: dto.content || '',
        tempInfo: dto.tempInfo || null,
        timeInfo: dto.timeInfo || null,
        ingredients: dto.ingredients ?? undefined,
        isCriticalPoint: dto.isCriticalPoint || false,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
  }

  async updateStage(stageId: string, dto: {
    name?: string; content?: string; tempInfo?: string; timeInfo?: string; isCriticalPoint?: boolean;
    ingredients?: { name: string; amount: string }[];
  }) {
    const stage = await this.prisma.recipeStage.findUnique({ where: { id: stageId } });
    if (!stage) throw new HttpException('Етап не знайдено', HttpStatus.NOT_FOUND);
    return this.prisma.recipeStage.update({
      where: { id: stageId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.tempInfo !== undefined && { tempInfo: dto.tempInfo || null }),
        ...(dto.timeInfo !== undefined && { timeInfo: dto.timeInfo || null }),
        ...(dto.ingredients !== undefined && { ingredients: dto.ingredients }),
        ...(dto.isCriticalPoint !== undefined && { isCriticalPoint: dto.isCriticalPoint }),
      },
    });
  }

  async deleteStage(stageId: string) {
    const stage = await this.prisma.recipeStage.findUnique({ where: { id: stageId } });
    if (!stage) throw new HttpException('Етап не знайдено', HttpStatus.NOT_FOUND);
    await this.prisma.recipeStage.delete({ where: { id: stageId } });
  }

  async reorderStages(sheetId: string, orderedIds: string[]) {
    await this.findOneSheet(sheetId);
    await this.prisma.$transaction(
      orderedIds.map((id, idx) =>
        this.prisma.recipeStage.update({ where: { id }, data: { sortOrder: idx } }),
      ),
    );
  }
}
