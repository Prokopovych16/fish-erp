export type AppRole = 'ADMIN' | 'WORKER' | 'ACCOUNTANT' | 'INSPECTOR';

export interface RouteConfig {
  path: string;
  label: string;
  roles: AppRole[];
}

export const ROUTES: RouteConfig[] = [
  { path: '/dashboard',  label: '📊 Дашборд',      roles: ['ADMIN', 'WORKER', 'ACCOUNTANT', 'INSPECTOR'] },
  { path: '/orders',     label: '📋 Заявки',        roles: ['ADMIN', 'WORKER', 'INSPECTOR'] },
  { path: '/archive',    label: '🗂 Архів',          roles: ['ADMIN', 'ACCOUNTANT', 'INSPECTOR'] },
  { path: '/warehouse',  label: '🏭 Склади',         roles: ['ADMIN'] },
  { path: '/production-calc', label: '💎 Калькулятор', roles: ['ADMIN'] },
  { path: '/clients',    label: '🤝 Клієнти',        roles: ['ADMIN', 'ACCOUNTANT'] },
  { path: '/products',   label: '🐟 Продукція',      roles: ['ADMIN', 'ACCOUNTANT', 'INSPECTOR'] },
  { path: '/statistics', label: '📈 Статистика',     roles: ['ADMIN', 'ACCOUNTANT'] },
  { path: '/settings',   label: '⚙️ Налаштування',   roles: ['ADMIN'] },
  { path: '/audit',      label: '🔍 Аудит',          roles: ['ADMIN'] },
];