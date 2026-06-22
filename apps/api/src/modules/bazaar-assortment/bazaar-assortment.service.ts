import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class BazaarAssortmentService {
  constructor(private prisma: PrismaService) {}

  findForClient(clientId: string) {
    return this.prisma.bazaarAssortmentItem.findMany({
      where: { clientId },
      include: { product: { select: { id: true, name: true, unit: true } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // Повністю замінює асортимент клієнта на переданий список (просто і узгоджено з тим,
  // як в проєкті вже редагуються позиції заявок — видалити старе, створити нове).
  async replaceForClient(clientId: string, items: { productId: string; displayUnit?: string }[]) {
    await this.prisma.bazaarAssortmentItem.deleteMany({ where: { clientId } });
    if (items.length > 0) {
      await this.prisma.bazaarAssortmentItem.createMany({
        data: items.map((item, idx) => ({
          clientId,
          productId: item.productId,
          displayUnit: item.displayUnit,
          sortOrder: idx,
        })),
      });
    }
    return this.findForClient(clientId);
  }
}
