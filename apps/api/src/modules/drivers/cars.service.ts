import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class CarsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.car.findMany({ orderBy: { number: 'asc' } });
  }
  create(dto: { number: string; brand?: string }) {
    return this.prisma.car.create({ data: dto });
  }
  update(id: string, dto: { number?: string; brand?: string }) {
    return this.prisma.car.update({ where: { id }, data: dto });
  }
  async toggle(id: string) {
    const c = await this.prisma.car.findUniqueOrThrow({ where: { id } });
    return this.prisma.car.update({
      where: { id },
      data: { isActive: !c.isActive },
    });
  }
}
