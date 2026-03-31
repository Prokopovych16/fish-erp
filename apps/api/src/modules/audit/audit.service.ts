import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    userId: string;
    action: string;
    entityId?: string;
    oldValue?: any;
    newValue?: any;
  }) {
    return this.prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityId: params.entityId,
        oldValue: params.oldValue ?? undefined,
        newValue: params.newValue ?? undefined,
      },
    });
  }

  async findAll(params: {
    userId?: string;
    action?: string;
    entityId?: string;
    from?: string;
    to?: string;
    page?: string;
    limit?: string;
  }) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 30;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.userId) where.userId = params.userId;
    if (params.action)
      where.action = { contains: params.action, mode: 'insensitive' };
    if (params.entityId) where.entityId = params.entityId;

    if (params.from || params.to) {
      where.createdAt = {
        ...(params.from && { gte: new Date(params.from) }),
        ...(params.to && { lte: new Date(params.to) }),
      };
    }

    const total = await this.prisma.auditLog.count({ where });

    const logs = await this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    // Підтягуємо дані про заявки для кожного лога
    // entityId для ORDER_* дій — це id заявки
    const orderIds = logs
      .filter((l) => l.action.startsWith('ORDER_') && l.entityId)
      .map((l) => l.entityId as string);

    const uniqueOrderIds = [...new Set(orderIds)];

    // Завантажуємо всі потрібні заявки одним запитом
    const orders =
      uniqueOrderIds.length > 0
        ? await this.prisma.order.findMany({
            where: { id: { in: uniqueOrderIds } },
            select: {
              id: true,
              number: true,
              numberForm: true,
              form: true,
              status: true,
              completedAt: true,
              client: {
                select: { id: true, name: true },
              },
              items: {
                select: {
                  id: true,
                  plannedWeight: true,
                  actualWeight: true,
                  pricePerKg: true,
                  product: {
                    select: { id: true, name: true, unit: true },
                  },
                },
              },
            },
          })
        : [];

    // Будуємо map для швидкого пошуку
    const ordersMap = new Map(orders.map((o) => [o.id, o]));

    // Додаємо дані заявки до кожного лога
    const enrichedLogs = logs.map((log) => ({
      ...log,
      order:
        log.action.startsWith('ORDER_') && log.entityId
          ? (ordersMap.get(log.entityId) ?? null)
          : null,
    }));

    return {
      data: enrichedLogs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
