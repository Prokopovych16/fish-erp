import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export interface FopDto {
  name: string;
  companyName: string;
  edrpou?: string;
  ipn?: string;
  iban?: string;
  address?: string;
  phone?: string;
  director?: string;
  isDefault?: boolean;
}

@Injectable()
export class FopsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.fop.findMany({ orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] });
  }

  async create(dto: FopDto) {
    if (dto.isDefault) await this.prisma.fop.updateMany({ data: { isDefault: false } });
    return this.prisma.fop.create({ data: dto });
  }

  async update(id: string, dto: Partial<FopDto>) {
    const fop = await this.prisma.fop.findUnique({ where: { id } });
    if (!fop) throw new NotFoundException('ФОП не знайдено');
    if (dto.isDefault) await this.prisma.fop.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
    return this.prisma.fop.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.fop.findUniqueOrThrow({ where: { id } });
    await this.prisma.order.updateMany({ where: { fopId: id }, data: { fopId: null } });
    return this.prisma.fop.delete({ where: { id } });
  }
}
