Система управління рибним виробництвом та дистрибуцією.

## Стек

- **Бекенд:** NestJS + TypeScript + Prisma ORM + PostgreSQL
- **Фронтенд:** React + Vite + TypeScript + Tailwind CSS v3
- **Монорепо:** npm workspaces

## Структура
```
fish-erp/
├── apps/
│   ├── api/     # NestJS бекенд (порт 3000)
│   └── web/     # React фронт (порт 5173)
└── package.json
```

## Запуск локально

### 1. Встановити залежності
```bash
npm install
```

### 2. Налаштувати `.env` в `apps/api/`
```env
DATABASE_URL="postgresql://user:password@localhost:5432/fish_erp"
JWT_SECRET="your_jwt_secret"
PORT=3000
```

### 3. Міграції БД
```bash
cd apps/api
npx prisma migrate deploy
npx prisma db seed
```

### 4. Запустити
```bash
# Бекенд
cd apps/api && npm run start:dev

# Фронтенд
cd apps/web && npm run dev
```

## Деплой на сервер

### Бекенд
```bash
cd apps/api
npm run build
pm2 start dist/main.js --name fish-api
```

### Фронтенд
```bash
cd apps/web
npm run build
# Статика в apps/web/dist/
```

## Функціонал

- 📋 Канбан заявок з Drag & Drop
- 🏭 Управління складами (5 типів)
- ⚙️ Виробничий калькулятор
- 🤝 Клієнти з прайс-листами Ф1/Ф2
- 📄 PDF документи (накладна, ТТН, декларація)
- 📈 Статистика і звіти
- 👥 Ролі: ADMIN, WORKER, ACCOUNTANT, INSPECTOR
EOF