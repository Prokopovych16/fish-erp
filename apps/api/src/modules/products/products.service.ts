import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // Всі продукти включаючи неактивні — для панелі адміна
  async findAll() {
    return this.prisma.product.findMany({
      orderBy: { name: 'asc' },
    });
  }

  // Тільки активні продукти — для випадаючих списків при створенні заявки
  async findActive() {
    return this.prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  // Один продукт по id
  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Продукт не знайдено');
    return product;
  }

  // Створити продукт
  async create(dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto });
  }

  // Оновити назву або одиницю виміру
  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id); // перевіряємо що існує
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  // Активувати / деактивувати
  // Деактивований продукт не зникає з існуючих заявок
  // але не доступний при створенні нових
  async toggle(id: string) {
    const product = await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: { isActive: !product.isActive },
    });
  }
}
