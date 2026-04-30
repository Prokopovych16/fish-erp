import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateCashEntryDto, UpdateCashEntryDto } from './dto/cash-entry.dto';

@Injectable()
export class CashService {
  constructor(private prisma: PrismaService) {}

  async getEntries(year: number, month: number) {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);
    return this.prisma.cashEntry.findMany({
      where: { date: { gte: from, lt: to } },
      orderBy: { date: 'asc' },
    });
  }

  async getSummaries() {
    const entries = await this.prisma.cashEntry.findMany({
      orderBy: { date: 'asc' },
    });

    const monthMap: Record<string, { year: number; month: number; entries: any[] }> = {};
    for (const e of entries) {
      const y = e.date.getFullYear();
      const m = e.date.getMonth() + 1;
      const key = `${y}-${m}`;
      if (!monthMap[key]) monthMap[key] = { year: y, month: m, entries: [] };
      monthMap[key].entries.push(e);
    }

    let cumulativeFund = 0;
    let cumulativeSalaryMe = 0;
    let cumulativeSalaryPartner = 0;
    let physicalCash = 0;

    const summaries = Object.values(monthMap).map(({ year, month, entries }) => {
      const sum = (type: string) =>
        entries.filter(e => e.type === type).reduce((s, e) => s + Number(e.amount), 0);

      const income = sum('INCOME');
      const expense = sum('EXPENSE');
      const salaryMe = sum('SALARY_ME');
      const salaryPartner = sum('SALARY_PARTNER');
      const salaryMeTake = sum('SALARY_ME_TAKE');
      const salaryPartnerTake = sum('SALARY_PARTNER_TAKE');
      const productionFund = sum('PRODUCTION_FUND');
      const productionFundUse = sum('PRODUCTION_FUND_USE');

      cumulativeFund += productionFund - productionFundUse;
      cumulativeSalaryMe += salaryMe - salaryMeTake;
      cumulativeSalaryPartner += salaryPartner - salaryPartnerTake;
      // Фізична готівка в сейфі: тільки фактичні надходження та виплати
      physicalCash += income - expense - salaryMeTake - salaryPartnerTake - productionFundUse;

      return {
        year, month,
        income, expense,
        salaryMe, salaryPartner,
        salaryMeTake, salaryPartnerTake,
        productionFund, productionFundUse,
        balance: income - expense - salaryMe - salaryPartner - productionFund,
        cumulativeFund,
        cumulativeSalaryMe,
        cumulativeSalaryPartner,
        physicalCash,
      };
    });

    return summaries;
  }

  async create(dto: CreateCashEntryDto) {
    return this.prisma.cashEntry.create({
      data: {
        date: new Date(dto.date),
        amount: dto.amount,
        type: dto.type,
        note: dto.note,
      },
    });
  }

  async update(id: string, dto: UpdateCashEntryDto) {
    return this.prisma.cashEntry.update({
      where: { id },
      data: {
        ...(dto.date && { date: new Date(dto.date) }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.type && { type: dto.type }),
        ...(dto.note !== undefined && { note: dto.note }),
      },
    });
  }

  async remove(id: string) {
    return this.prisma.cashEntry.delete({ where: { id } });
  }
}
