import { create } from 'zustand';
import { User } from '@/types';

interface AuthState {
  user: User | null;           // поточний користувач
  token: string | null;        // JWT токен
  isAuthenticated: boolean;    // чи залогінений

  setAuth: (user: User, token: string) => void;  // встановити після логіну
  logout: () => void;                             // вийти з системи
}

// Zustand store — простий глобальний стан
// Завантажуємо з localStorage якщо вже були залогінені
export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),

  setAuth: (user, token) => {
    // зберігаємо в localStorage щоб не втрачати після перезавантаження
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));