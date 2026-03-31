import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class DriversService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.driver.findMany({ orderBy: { name: 'asc' } });
  }
  create(dto: { name: string }) {
    return this.prisma.driver.create({ data: dto });
  }
  update(id: string, dto: { name?: string }) {
    return this.prisma.driver.update({ where: { id }, data: dto });
  }
  async toggle(id: string) {
    const d = await this.prisma.driver.findUniqueOrThrow({ where: { id } });
    return this.prisma.driver.update({
      where: { id },
      data: { isActive: !d.isActive },
    });
  }
}
