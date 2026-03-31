import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  // Отримати всі налаштування у вигляді об'єкту key: value
  async getAll() {
    const settings = await this.prisma.systemSettings.findMany();

    // Перетворюємо масив записів в зручний об'єкт
    // [{ key: 'companyName', value: 'ТОВ Риба' }] → { companyName: 'ТОВ Риба' }
    return settings.reduce(
      (acc, item) => {
        acc[item.key] = item.value;
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  // Зберегти налаштування — приймаємо об'єкт і зберігаємо кожне поле
  async update(data: Record<string, string>) {
    const operations = Object.entries(data).map(([key, value]) =>
      this.prisma.systemSettings.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      }),
    );

    await this.prisma.$transaction(operations);
    return this.getAll();
  }

  // Отримати одне налаштування по ключу — використовується в PDF генерації
  async getValue(key: string): Promise<string> {
    const setting = await this.prisma.systemSettings.findUnique({
      where: { key },
    });
    return setting?.value ?? '';
  }
}
