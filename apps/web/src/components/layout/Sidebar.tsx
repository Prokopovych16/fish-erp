import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { ROUTES } from '@/config/routes';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuthStore();

  const visibleItems = ROUTES.filter(
    (item) => user && item.roles.includes(user.role as any)
  );

  const roleLabel: Record<string, string> = {
    ADMIN: 'Адміністратор',
    WORKER: 'Працівник',
    ACCOUNTANT: 'Бухгалтер',
    INSPECTOR: 'Перевірка',
  };

  return (
    <aside className={`
      fixed top-0 left-0 h-full z-30 w-56 bg-white border-r border-gray-200
      flex flex-col transition-transform duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      lg:relative lg:translate-x-0 lg:z-auto
    `}>
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">🐟 Fish ERP</h1>
        <button
          onClick={onClose}
          className="lg:hidden p-1 rounded-lg hover:bg-gray-100 text-gray-500 text-xl leading-none"
        >
          ×
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-200">
        <div className="text-sm font-medium text-gray-700 truncate">{user?.name}</div>
        <div className="text-xs text-gray-400 mb-2">
          {user?.role ? roleLabel[user.role] : ''}
        </div>
        <button
          onClick={() => { logout(); onClose(); }}
          className="w-full text-left text-xs text-red-500 hover:text-red-700 transition-colors py-1"
        >
          → Вийти
        </button>
      </div>
    </aside>
  );
}