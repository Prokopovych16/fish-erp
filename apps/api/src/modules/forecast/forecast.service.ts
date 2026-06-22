import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { OrderStatus } from '@prisma/client';

interface BomEdge {
  inputKey: string;
  yieldPct: number;
  leadDays: number;
}

interface Contributor {
  key: string;
  name: string;
  qty: number; // скільки кг сировини потрібно саме через цей товар
}

interface RawNeed {
  total: number;
  leadDaysMax: number;
  contributors: Contributor[];
}

@Injectable()
export class ForecastService {
  constructor(private prisma: PrismaService) {}

  async getForecast(weeks = 8) {
    const since = new Date();
    since.setDate(since.getDate() - weeks * 7);

    const [products, bomRows, orderItems, stockRows] = await Promise.all([
      this.prisma.product.findMany({
        where: { isActive: true },
        include: { group: { select: { id: true, name: true } } },
      }),
      this.prisma.productBOM.findMany(),
      this.prisma.orderItem.findMany({
        where: {
          order: {
            status: { in: [OrderStatus.PENDING, OrderStatus.IN_PROGRESS, OrderStatus.DONE] },
            createdAt: { gte: since },
          },
        },
        select: { productId: true, plannedWeight: true, actualWeight: true },
      }),
      this.prisma.stockItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
        where: { quantity: { gt: 0 } },
      }),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));

    // ─── Канонічний ключ: товари в одній групі взаємозаміни рахуються як одна позиція ───
    // (наприклад "скумбрія х/к вагова" і "скумбрія х/к в/у" — фізично один і той самий товар)
    const canonicalKey = (productId: string): string => {
      const p = productMap.get(productId);
      return p?.groupId ? `g:${p.groupId}` : productId;
    };
    const canonicalName = (key: string): string => {
      if (key.startsWith('g:')) {
        const groupId = key.slice(2);
        const member = products.find((p) => p.groupId === groupId);
        return member?.group?.name ?? 'Група товарів';
      }
      return productMap.get(key)?.name ?? key;
    };
    const canonicalUnit = (key: string): string => {
      if (key.startsWith('g:')) {
        const groupId = key.slice(2);
        const member = products.find((p) => p.groupId === groupId);
        return member?.unit ?? 'кг';
      }
      return productMap.get(key)?.unit ?? 'кг';
    };

    // вихід BOM-зв'язків по канонічному товару, що виробляється
    const bomByOutput = new Map<string, BomEdge[]>();
    for (const row of bomRows) {
      const outKey = canonicalKey(row.outputProductId);
      const inKey = canonicalKey(row.inputProductId);
      const list = bomByOutput.get(outKey) ?? [];
      list.push({ inputKey: inKey, yieldPct: Number(row.yieldPct), leadDays: row.leadDays });
      bomByOutput.set(outKey, list);
    }
    const isManufactured = new Set(bomByOutput.keys());

    // фактичний залишок на складі — сумуємо по канонічному ключу (по всій групі разом)
    const stock = new Map<string, number>();
    for (const r of stockRows) {
      const key = canonicalKey(r.productId);
      stock.set(key, (stock.get(key) ?? 0) + Number(r._sum.quantity ?? 0));
    }

    // середній тижневий попит — теж по канонічному ключу
    const demandSum = new Map<string, number>();
    for (const item of orderItems) {
      const w = Number(item.actualWeight ?? item.plannedWeight);
      if (w <= 0) continue;
      const key = canonicalKey(item.productId);
      demandSum.set(key, (demandSum.get(key) ?? 0) + w);
    }
    const weeklyDemand = new Map<string, number>();
    for (const [key, total] of demandSum) {
      weeklyDemand.set(key, total / weeks);
    }

    // крок 1: чистий дефіцит готового товару (попит - наявний запас, по всій групі разом)
    const netDemand = new Map<string, number>();
    for (const [key, demand] of weeklyDemand) {
      const have = stock.get(key) ?? 0;
      const shortfall = Math.max(demand - have, 0);
      if (shortfall > 0) netDemand.set(key, shortfall);
    }

    // крок 2: рекурсивно розгортаємо дефіцит у потребу сировини
    const rawNeed = new Map<string, RawNeed>();
    const MAX_DEPTH = 10;

    const propagate = (
      key: string,
      qty: number,
      leadDaysAcc: number,
      originKey: string,
      originName: string,
      depth: number,
    ) => {
      if (qty <= 0 || depth > MAX_DEPTH) return;
      const edges = bomByOutput.get(key);
      if (edges && edges.length > 0) {
        for (const edge of edges) {
          const yieldFraction = edge.yieldPct > 0 ? edge.yieldPct / 100 : 1;
          const inputQty = qty / yieldFraction;
          propagate(edge.inputKey, inputQty, leadDaysAcc + edge.leadDays, originKey, originName, depth + 1);
        }
      } else {
        const entry = rawNeed.get(key) ?? { total: 0, leadDaysMax: 0, contributors: [] };
        entry.total += qty;
        entry.leadDaysMax = Math.max(entry.leadDaysMax, leadDaysAcc);
        const existing = entry.contributors.find((c) => c.key === originKey);
        if (existing) existing.qty += qty;
        else entry.contributors.push({ key: originKey, name: originName, qty });
        rawNeed.set(key, entry);
      }
    };

    for (const [key, qty] of netDemand) {
      propagate(key, qty, 0, key, canonicalName(key), 0);
    }

    // крок 3: фінальний список товарів для закупівлі (тих, що нічим не виробляються)
    const today = new Date();
    const nextWeekStart = new Date(today);
    nextWeekStart.setDate(today.getDate() + ((7 - today.getDay() + 1) % 7 || 7));

    // усі канонічні ключі, які колись фігурували (попит, запас або потреба сировини)
    const allKeys = new Set<string>([...weeklyDemand.keys(), ...stock.keys(), ...rawNeed.keys()]);
    const purchasableKeys = Array.from(allKeys).filter((key) => !isManufactured.has(key));

    const result = purchasableKeys
      .map((key) => {
        const need = rawNeed.get(key);
        const totalNeeded = need?.total ?? 0;
        const currentStock = stock.get(key) ?? 0;
        const toOrder = Math.max(totalNeeded - currentStock, 0);
        const leadDays = need?.leadDaysMax ?? 0;
        const orderByDate = new Date(nextWeekStart);
        orderByDate.setDate(orderByDate.getDate() - leadDays);

        return {
          productId: key,
          productName: canonicalName(key),
          unit: canonicalUnit(key),
          weeklyDemand: weeklyDemand.get(key) ?? 0,
          currentStock,
          totalNeeded,
          toOrder,
          leadDays,
          orderByDate: orderByDate.toISOString(),
          contributors: (need?.contributors ?? [])
            .sort((a, b) => b.qty - a.qty)
            .map((c) => ({ productId: c.key, productName: c.name, qty: Math.round(c.qty * 1000) / 1000 })),
        };
      })
      .filter((r) => r.totalNeeded > 0 || r.currentStock > 0)
      .sort((a, b) => b.toOrder - a.toOrder);

    return {
      weeks,
      nextWeekStart: nextWeekStart.toISOString(),
      items: result,
    };
  }
}
