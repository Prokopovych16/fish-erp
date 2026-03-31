import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // АДМІН
  const password = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@fish-erp.com' },
    update: {},
    create: {
      name: 'Адмін',
      email: 'admin@fish-erp.com',
      password,
      role: 'ADMIN',
    },
  });
  console.log('✅ Адмін створено');

  // НАЛАШТУВАННЯ
  const defaultSettings = [
    { key: 'companyName', value: 'ТОВ Назва компанії' },
    { key: 'edrpou', value: '12345678' },
    { key: 'address', value: 'м. Вінниця, вул. Прикладна, 1' },
    { key: 'phone', value: '+380 XX XXX XX XX' },
    { key: 'director', value: 'Прізвище І.П.' },
  ];
  for (const setting of defaultSettings) {
    await prisma.systemSettings.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log('✅ Налаштування створено');

  // СКЛАДИ
  const warehouses = [
    {
      name: 'Склад сировини',
      type: 'RAW_MATERIAL' as const,
      description: 'Сировина яка щойно надійшла',
    },
    {
      name: 'Виробництво',
      type: 'IN_PRODUCTION' as const,
      description: 'Продукція в процесі обробки',
    },
    {
      name: 'Склад готової продукції',
      type: 'FINISHED_GOODS' as const,
      description: 'Готова продукція до відвантаження',
    },
    {
      name: 'Холодильник №1',
      type: 'FRIDGE' as const,
      description: 'Основний холодильник',
    },
    {
      name: 'Витратні матеріали',
      type: 'SUPPLIES' as const,
      description: 'Пакування та витратні матеріали',
    },
  ];

  for (const warehouse of warehouses) {
    const existing = await prisma.warehouse.findFirst({
      where: { name: warehouse.name },
    });
    if (!existing) {
      await prisma.warehouse.create({
        data: {
          name: warehouse.name,
          type: warehouse.type,
          description: warehouse.description,
          isActive: true,
        },
      });
    }
  }
  console.log('✅ Склади створено');
}

main()
  .catch((e) => {
    console.error('❌ Помилка seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
