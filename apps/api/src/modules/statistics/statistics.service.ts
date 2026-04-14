import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { OrderStatus, Form, UserRole } from '@prisma/client';

@Injectable()
export class StatisticsService {
  constructor(private prisma: PrismaService) {}

  // Допоміжний метод — будує фільтр по даті і формі
  private buildWhereFilter(
    from?: string,
    to?: string,
    form?: Form,
    userRole?: UserRole,
  ) {
    const where: any = {
      status: OrderStatus.DONE,
      deletedAt: null,
    };

    if (userRole === UserRole.INSPECTOR) {
      where.form = Form.FORM_1;
    } else if (form) {
      where.form = form;
    }

    if (from || to) {
      where.completedAt = {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      };
    }

    return where;
  }

  // Виручка по позиції — 0 якщо шт без фактичної ваги
  private calcItemRevenue(item: any): number {
    if (item.product?.unit === 'шт' && !item.actualWeight) return 0;
    return (
      Number(item.actualWeight ?? item.plannedWeight) *
      Number(item.pricePerKg ?? 0)
    );
  }

  // ============================================================
  // ДАШБОРД
  // ============================================================
  async getDashboard(from?: string, to?: string, form?: Form) {
    const where = this.buildWhereFilter(from, to, form);

    const orders = await this.prisma.order.findMany({
      where,
      include: { items: { include: { product: true } } },
    });

    const totalRevenue = orders.reduce((sum, order) => {
      return sum + order.items.reduce((s, item) => s + this.calcItemRevenue(item), 0);
    }, 0);

    const revenueByForm = await this.getRevenueByForm(from, to);

    const activeOrders = await this.prisma.order.count({
      where: {
        deletedAt: null,
        status: { in: [OrderStatus.PENDING, OrderStatus.IN_PROGRESS] },
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const completedToday = await this.prisma.order.count({
      where: {
        status: OrderStatus.DONE,
        deletedAt: null,
        completedAt: { gte: today },
      },
    });

    const stock = await this.prisma.warehouse.findMany({
      where: { isActive: true },
      include: {
        stockItems: {
          where: { quantity: { gt: 0 } },
          include: { product: true },
          orderBy: { arrivedAt: 'desc' },
        },
      },
    });

    const topClients = await this.getTopClients(from, to, form, 5);
    const ordersChart = await this.getOrdersChart(from, to, form);

    const lastOrders = await this.prisma.order.findMany({
      where: { status: OrderStatus.DONE, deletedAt: null },
      include: { client: true, items: { include: { product: true } } },
      orderBy: { completedAt: 'desc' },
      take: 5,
    });

    return {
      totalRevenue,
      revenueByForm,
      activeOrders,
      completedToday,
      totalCompletedInPeriod: orders.length,
      stock,
      topClients,
      ordersChart,
      lastOrders,
    };
  }

  // ============================================================
  // ФІНАНСИ — виручка по формах
  // ============================================================
  async getRevenueByForm(from?: string, to?: string) {
    const results: Record<string, number> = { FORM_1: 0, FORM_2: 0, total: 0 };

    for (const form of [Form.FORM_1, Form.FORM_2]) {
      const where = this.buildWhereFilter(from, to, form);
      const orders = await this.prisma.order.findMany({
        where,
        include: { items: { include: { product: true } } },
      });

      const revenue = orders.reduce((sum, order) => {
        return sum + order.items.reduce((s, item) => s + this.calcItemRevenue(item), 0);
      }, 0);

      results[form] = revenue;
      results.total += revenue;
    }

    return results;
  }

  // ============================================================
  // ГРАФІК — виручка і кількість по днях
  // ============================================================
  async getOrdersChart(from?: string, to?: string, form?: Form) {
    const where = this.buildWhereFilter(from, to, form);

    const orders = await this.prisma.order.findMany({
      where,
      include: { items: { include: { product: true } } },
      orderBy: { completedAt: 'asc' },
    });

    const byDay: Record<string, { date: string; count: number; revenue: number }> = {};

    for (const order of orders) {
      const date = order.completedAt!.toISOString().split('T')[0];
      if (!byDay[date]) byDay[date] = { date, count: 0, revenue: 0 };
      byDay[date].count++;
      byDay[date].revenue += order.items.reduce((s, item) => s + this.calcItemRevenue(item), 0);
    }

    return Object.values(byDay);
  }

  // ============================================================
  // КЛІЄНТИ — топ по виручці
  // ============================================================
  async getTopClients(from?: string, to?: string, form?: Form, limit = 10) {
    const where = this.buildWhereFilter(from, to, form);

    const orders = await this.prisma.order.findMany({
      where,
      include: { client: true, items: { include: { product: true } } },
    });

    const clientMap: Record<
      string,
      { clientId: string; clientName: string; revenue: number; ordersCount: number; totalWeightKg: number; totalPcs: number }
    > = {};

    for (const order of orders) {
      const id = order.clientId;
      if (!clientMap[id]) {
        clientMap[id] = { clientId: id, clientName: order.client.name, revenue: 0, ordersCount: 0, totalWeightKg: 0, totalPcs: 0 };
      }

      clientMap[id].ordersCount++;
      clientMap[id].revenue += order.items.reduce((s, item) => s + this.calcItemRevenue(item), 0);

      for (const item of order.items) {
        const unit = item.product?.unit;
        const qty = Number(item.actualWeight ?? item.plannedWeight);
        if (unit === 'шт') clientMap[id].totalPcs += qty;
        else clientMap[id].totalWeightKg += qty;
      }
    }

    return Object.values(clientMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  // ============================================================
  // ПРОДУКЦІЯ — топ по вазі і сумі
  // ============================================================
  async getProductsStats(from?: string, to?: string, form?: Form) {
    const where = this.buildWhereFilter(from, to, form);

    const orders = await this.prisma.order.findMany({
      where,
      include: { items: { include: { product: true } } },
    });

    const productMap: Record<
      string,
      {
        productId: string;
        productName: string;
        productUnit: string;
        totalPlannedWeight: number;
        totalActualWeight: number;
        revenue: number;
        ordersCount: number;
        weightAccuracy: number;
      }
    > = {};

    for (const order of orders) {
      for (const item of order.items) {
        const id = item.productId;
        if (!productMap[id]) {
          productMap[id] = {
            productId: id,
            productName: item.product.name,
            productUnit: item.product.unit,
            totalPlannedWeight: 0,
            totalActualWeight: 0,
            revenue: 0,
            ordersCount: 0,
            weightAccuracy: 0,
          };
        }

        productMap[id].totalPlannedWeight += Number(item.plannedWeight);
        productMap[id].totalActualWeight += Number(item.actualWeight ?? item.plannedWeight);
        productMap[id].revenue += this.calcItemRevenue(item);
        productMap[id].ordersCount++;
      }
    }

    for (const p of Object.values(productMap)) {
      if (p.totalPlannedWeight > 0) {
        p.weightAccuracy =
          ((p.totalActualWeight - p.totalPlannedWeight) / p.totalPlannedWeight) * 100;
      }
    }

    return Object.values(productMap).sort((a, b) => b.revenue - a.revenue);
  }

  // ============================================================
  // ЗАЯВКИ — загальна статистика
  // ============================================================
  async getOrdersStats(from?: string, to?: string, form?: Form) {
    const formFilter = form ? { form } : {};

    // Для DONE — фільтр по completedAt
    const completedDateFilter = from || to ? {
      completedAt: {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      },
    } : {};

    // Для поточних статусів (PENDING, IN_PROGRESS, CANCELLED) — фільтр по createdAt
    const createdDateFilter = from || to ? {
      createdAt: {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      },
    } : {};

    const [done, cancelled, pending, inProgress] = await Promise.all([
      this.prisma.order.count({
        where: { ...completedDateFilter, ...formFilter, status: OrderStatus.DONE, deletedAt: null },
      }),
      this.prisma.order.count({
        where: { ...createdDateFilter, ...formFilter, status: OrderStatus.CANCELLED, deletedAt: null },
      }),
      this.prisma.order.count({
        where: { ...formFilter, status: OrderStatus.PENDING, deletedAt: null },
      }),
      this.prisma.order.count({
        where: { ...formFilter, status: OrderStatus.IN_PROGRESS, deletedAt: null },
      }),
    ]);

    const completedOrders = await this.prisma.order.findMany({
      where: { ...completedDateFilter, ...formFilter, status: OrderStatus.DONE, deletedAt: null },
      select: { createdAt: true, completedAt: true },
    });

    const avgCompletionTimeHours =
      completedOrders.length > 0
        ? completedOrders.reduce((sum, o) => {
            const diff = o.completedAt!.getTime() - o.createdAt.getTime();
            return sum + diff / (1000 * 60 * 60);
          }, 0) / completedOrders.length
        : 0;

    return {
      done,
      cancelled,
      pending,
      inProgress,
      total: done + cancelled + pending + inProgress,
      cancelledPercent:
        done + cancelled > 0 ? ((cancelled / (done + cancelled)) * 100).toFixed(1) : 0,
      avgCompletionTimeHours: avgCompletionTimeHours.toFixed(1),
    };
  }

  // ============================================================
  // ПРАЦІВНИКИ — продуктивність
  // ============================================================
  async getWorkersStats(from?: string, to?: string) {
    const dateFilter = from || to ? {
      completedAt: {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      },
    } : {};

    const orders = await this.prisma.order.findMany({
      where: { status: OrderStatus.DONE, deletedAt: null, ...dateFilter },
      include: {
        assignedTo: { select: { id: true, name: true } },
        items: { include: { product: true } },
      },
    });

    const workerMap: Record<
      string,
      { workerId: string; workerName: string; ordersCount: number; totalWeightKg: number; totalPcs: number; avgWeightDiff: number }
    > = {};

    for (const order of orders) {
      if (!order.assignedTo) continue;

      const id = order.assignedTo.id;
      if (!workerMap[id]) {
        workerMap[id] = { workerId: id, workerName: order.assignedTo.name, ordersCount: 0, totalWeightKg: 0, totalPcs: 0, avgWeightDiff: 0 };
      }

      workerMap[id].ordersCount++;

      let totalDiff = 0;
      let itemCount = 0;

      for (const item of order.items) {
        const actual = Number(item.actualWeight ?? item.plannedWeight);
        const planned = Number(item.plannedWeight);
        const unit = item.product?.unit;
        if (unit === 'шт') workerMap[id].totalPcs += actual;
        else workerMap[id].totalWeightKg += actual;
        totalDiff += Math.abs(actual - planned);
        itemCount++;
      }

      if (itemCount > 0) {
        workerMap[id].avgWeightDiff += totalDiff / itemCount;
      }
    }

    for (const w of Object.values(workerMap)) {
      if (w.ordersCount > 0) {
        w.avgWeightDiff = w.avgWeightDiff / w.ordersCount;
      }
    }

    return Object.values(workerMap).sort((a, b) => b.ordersCount - a.ordersCount);
  }

  async getProduction(from: string, to: string) {
    const calcs = await this.prisma.productionCalc.findMany({
      where: { createdAt: { gte: new Date(from), lte: new Date(to) } },
      include: { inputs: true, outputs: true },
    });

    const totalBatches = calcs.length;
    const avgYield =
      calcs.length > 0
        ? calcs.reduce((s, c) => {
            const inQty = c.inputs.reduce((si, i) => si + Number(i.quantity), 0);
            const outQty = Number(c.totalOutputQty);
            return s + (inQty > 0 ? (outQty / inQty) * 100 : 0);
          }, 0) / calcs.length
        : 0;

    const avgCostPerKg =
      calcs.length > 0
        ? calcs.reduce((s, c) => s + Number(c.costPerKg), 0) / calcs.length
        : 0;

    const byProduct: Record<
      string,
      { name: string; batches: number; totalInput: number; totalOutput: number; avgYield: number; avgCost: number }
    > = {};
    for (const calc of calcs) {
      for (const out of calc.outputs) {
        if (!byProduct[out.productName]) {
          byProduct[out.productName] = { name: out.productName, batches: 0, totalInput: 0, totalOutput: 0, avgYield: 0, avgCost: 0 };
        }
        const inQty = calc.inputs.reduce((s, i) => s + Number(i.quantity), 0);
        byProduct[out.productName].batches++;
        byProduct[out.productName].totalInput += inQty;
        byProduct[out.productName].totalOutput += Number(out.quantity);
        byProduct[out.productName].avgCost += Number(calc.costPerKg);
      }
    }
    const products = Object.values(byProduct).map((p) => ({
      ...p,
      avgYield: p.totalInput > 0 ? (p.totalOutput / p.totalInput) * 100 : 0,
      avgCost: p.batches > 0 ? p.avgCost / p.batches : 0,
    }));

    const byDate: Record<string, { date: string; yield: number; cost: number; count: number }> = {};
    for (const calc of calcs) {
      const date = new Date(calc.createdAt).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
      if (!byDate[date]) byDate[date] = { date, yield: 0, cost: 0, count: 0 };
      const inQty = calc.inputs.reduce((s, i) => s + Number(i.quantity), 0);
      const outQty = Number(calc.totalOutputQty);
      byDate[date].yield += inQty > 0 ? (outQty / inQty) * 100 : 0;
      byDate[date].cost += Number(calc.costPerKg);
      byDate[date].count++;
    }
    const chart = Object.values(byDate).map((d) => ({
      date: d.date,
      yield: d.count > 0 ? d.yield / d.count : 0,
      cost: d.count > 0 ? d.cost / d.count : 0,
    }));

    return { totalBatches, avgYield, avgCostPerKg, products, chart };
  }
}
