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
  { path: '/warehouse',  label: '🏭 Склади',         roles: ['ADMIN', 'INSPECTOR'] },
  { path: '/production-calc', label: '💎 Калькулятор', roles: ['ADMIN', 'INSPECTOR'] },
  { path: '/clients',    label: '🤝 Клієнти',        roles: ['ADMIN', 'ACCOUNTANT', 'INSPECTOR'] },
  { path: '/products',   label: '🐟 Продукція',      roles: ['ADMIN', 'ACCOUNTANT', 'INSPECTOR'] },
  { path: '/statistics', label: '📈 Статистика',     roles: ['ADMIN', 'ACCOUNTANT', 'INSPECTOR'] },
  { path: '/settings',   label: '⚙️ Налаштування',   roles: ['ADMIN'] },
  { path: '/audit',      label: '🔍 Аудит',          roles: ['ADMIN', 'INSPECTOR'] },
];