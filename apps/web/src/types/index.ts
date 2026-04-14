// Ролі користувачів
export type UserRole = 'ADMIN' | 'WORKER' | 'ACCOUNTANT' | 'INSPECTOR';

// Форми обліку
export type Form = 'FORM_1' | 'FORM_2';

// Статуси заявок
export type OrderStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

// Типи складів
type WarehouseType = 'RAW_MATERIAL' | 'IN_PRODUCTION' | 'FINISHED_GOODS' | 'FRIDGE' | 'SUPPLIES';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  edrpou?: string;
  address?: string;
  contact?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  unit: string;
  isActive: boolean;
  category?: 'FISH' | 'SUPPLY';
  groupId?: string | null;
  storageTemp?: string;
  storageDays?: number;
  storageHumidity?: string;
  storageStandard?: string;
  packagingType?: string;
}

export interface ClientPrice {
  id: string;
  clientId: string;
  productId: string;
  price: number;
  form: Form;
  product: Product;
}

export interface Warehouse {
  id: string;
  name: string;
  type: WarehouseType;
  description?: string;
  isActive: boolean;
}

export interface StockItem {
  id: string;
  warehouseId: string;
  productId: string;
  quantity: number;
  product: Product;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  plannedWeight: number;
  actualWeight?: number;
  pricePerKg?: number;
  product: Product;
}

export interface Order {
  id: string;
  number: number;
  clientId: string;
  form: Form;
  status: OrderStatus;
  createdById: string;
  assignedToId?: string;
  plannedDate?: string;
  completedAt?: string;
  driverName?: string;
  carNumber?: string;
  deliveryAddress?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  client: Client;
  items: OrderItem[];
  createdBy: { id: string; name: string };
  assignedTo?: { id: string; name: string };
}

export interface AuthResponse {
  token: string;
  user: User;
}