import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.product.findMany({
      orderBy: { name: 'asc' },
      include: { group: true },
    });
  }

  async findActive() {
    return this.prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { group: true },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { group: true },
    });
    if (!product) throw new NotFoundException('Продукт не знайдено');
    return product;
  }

  async create(dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto, include: { group: true } });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    const { groupId, ...rest } = dto;
    return this.prisma.product.update({
      where: { id },
      data: {
        ...rest,
        ...(groupId !== undefined && { groupId: groupId || null }),
      },
      include: { group: true },
    });
  }

  async toggle(id: string) {
    const product = await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: { isActive: !product.isActive },
      include: { group: true },
    });
  }

  // ─── Product Groups ──────────────────────────────────────────────────────────

  async findAllGroups() {
    return this.prisma.productGroup.findMany({
      orderBy: { name: 'asc' },
      include: { products: { where: { isActive: true }, select: { id: true, name: true, unit: true } } },
    });
  }

  async createGroup(name: string) {
    const existing = await this.prisma.productGroup.findUnique({ where: { name } });
    if (existing) throw new BadRequestException('Група з такою назвою вже існує');
    return this.prisma.productGroup.create({
      data: { name },
      include: { products: { select: { id: true, name: true, unit: true } } },
    });
  }

  async updateGroup(id: string, name: string) {
    const group = await this.prisma.productGroup.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('Групу не знайдено');
    return this.prisma.productGroup.update({
      where: { id },
      data: { name },
      include: { products: { select: { id: true, name: true, unit: true } } },
    });
  }

  async deleteGroup(id: string) {
    const group = await this.prisma.productGroup.findUnique({
      where: { id },
      include: { products: { where: { isActive: true } } },
    });
    if (!group) throw new NotFoundException('Групу не знайдено');
    if (group.products.length > 0) {
      throw new BadRequestException('Не можна видалити групу, яка має активні продукти');
    }
    // Знімаємо groupId з неактивних продуктів
    await this.prisma.product.updateMany({ where: { groupId: id }, data: { groupId: null } });
    await this.prisma.productGroup.delete({ where: { id } });
    return { ok: true };
  }
}
