import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UpsertPricesDto } from './dto/upsert-price.dto';
import { Form } from '@prisma/client';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  // Отримати всіх клієнтів
  async findAll() {
    return this.prisma.client.findMany({
      orderBy: { name: 'asc' },
    });
  }

  // Отримати одного клієнта з його прайсами
  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        prices: {
          include: {
            product: true, // підтягуємо дані продукту до кожного прайсу
          },
        },
      },
    });

    if (!client) throw new NotFoundException('Клієнта не знайдено');
    return client;
  }

  // Створити клієнта
  async create(dto: CreateClientDto) {
    return this.prisma.client.create({ data: dto });
  }

  // Оновити дані клієнта
  async update(id: string, dto: UpdateClientDto) {
    await this.findOneOrFail(id);
    return this.prisma.client.update({ where: { id }, data: dto });
  }

  // Активувати / деактивувати клієнта
  async toggle(id: string) {
    const client = await this.findOneOrFail(id);
    return this.prisma.client.update({
      where: { id },
      data: { isActive: !client.isActive },
    });
  }

  // Отримати прайс клієнта — можна фільтрувати по формі
  async getPrices(id: string, form?: Form) {
    await this.findOneOrFail(id);

    return this.prisma.clientPrice.findMany({
      where: {
        clientId: id,
        // якщо form передано — фільтруємо, якщо ні — повертаємо всі
        ...(form && { form }),
      },
      include: {
        product: true, // назва і одиниця виміру продукту
      },
      orderBy: { product: { name: 'asc' } },
    });
  }

  // Зберегти ціни клієнта
  // upsert = update + insert — якщо запис є то оновлює, якщо немає то створює
  async upsertPrices(id: string, dto: UpsertPricesDto) {
    await this.findOneOrFail(id);

    // Виконуємо всі операції в одній транзакції
    // якщо щось впаде — всі зміни відкочуються
    const operations = dto.prices.map((item) =>
      this.prisma.clientPrice.upsert({
        where: {
          clientId_productId_form: {
            clientId: id,
            productId: item.productId,
            form: item.form,
          },
        },
        update: { price: item.price },
        create: {
          clientId: id,
          productId: item.productId,
          price: item.price,
          form: item.form,
        },
      }),
    );

    await this.prisma.$transaction(operations);
    return { message: 'Ціни збережено' };
  }

  private async findOneOrFail(id: string) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) throw new NotFoundException('Клієнта не знайдено');
    return client;
  }

  async getDeliveryPoints(clientId: string) {
    return this.prisma.deliveryPoint.findMany({
      where: { clientId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createDeliveryPoint(
    clientId: string,
    dto: { name: string; address?: string },
  ) {
    return this.prisma.deliveryPoint.create({
      data: { clientId, name: dto.name, address: dto.address },
    });
  }

  async updateDeliveryPoint(
    pointId: string,
    dto: { name?: string; address?: string },
  ) {
    return this.prisma.deliveryPoint.update({
      where: { id: pointId },
      data: dto,
    });
  }

  async toggleDeliveryPoint(pointId: string) {
    const point = await this.prisma.deliveryPoint.findUnique({
      where: { id: pointId },
    });
    return this.prisma.deliveryPoint.update({
      where: { id: pointId },
      data: { isActive: !point!.isActive },
    });
  }
}
