import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { User, UserRole } from '@/types';

// ============================================================
// Модалка користувача
// ============================================================
function UserModal({ user, onClose }: { user?: User; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [role, setRole] = useState<UserRole>(user?.role || 'WORKER');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const roleLabel: Record<UserRole, string> = {
    ADMIN: 'Адміністратор',
    WORKER: 'Працівник',
    ACCOUNTANT: 'Бухгалтер',
    INSPECTOR: 'Перевірка (INSPECTOR)',
  };
  const roleDesc: Record<UserRole, string> = {
    ADMIN: 'Повний доступ до всіх функцій',
    WORKER: 'Kanban дошка, фактична вага',
    ACCOUNTANT: 'Фінанси, архів, звіти',
    INSPECTOR: 'Тільки Форма 1, без цін',
  };

  const handleSave = async () => {
    if (!name.trim()) return setError('Вкажіть ім\'я');
    if (!user && !email.trim()) return setError('Вкажіть email');
    if (!user && !password.trim()) return setError('Вкажіть пароль');
    setLoading(true); setError('');
    try {
      if (user) {
        await api.patch(`/users/${user.id}`, { name, role });
        if (password.trim()) await api.patch(`/users/${user.id}/password`, { password });
      } else {
        await api.post('/users', { name, email, role, password });
      }
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Помилка збереження');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-800">
            {user ? 'Редагувати користувача' : 'Новий користувач'}
          </h2>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ім'я *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Іван Іваненко" />
          </div>
          {!user && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ivan@fish-erp.com" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Роль</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Object.entries(roleLabel).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <div className="text-xs text-gray-400 mt-1 pl-1">{roleDesc[role]}</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Пароль {user && <span className="text-gray-400">(порожньо = не змінювати)</span>}
            </label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••" />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          {error && <div className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
        </div>
        <div className="p-4 border-t flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg hover:bg-gray-50">Скасувати</button>
          <button onClick={handleSave} disabled={loading} className="flex-1 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Збереження...' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Реквізити компанії
// ============================================================
function CompanySettings() {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then((r) => r.data),
  });
  useEffect(() => { if (data) setValues(data); }, [data]);

  const fields = [
    { key: 'companyName', label: 'Назва компанії', placeholder: 'ТОВ Рибний цех', icon: '🏢' },
    { key: 'edrpou', label: 'ЄДРПОУ', placeholder: '12345678', icon: '📋' },
    { key: 'ipn', label: 'ІПН', placeholder: '1234567890', icon: '🔢' },
    { key: 'iban', label: 'Розрахунковий рахунок (IBAN)', placeholder: 'UA123456789012345678901234567', icon: '🏦' },
    { key: 'address', label: 'Адреса', placeholder: 'м. Київ, вул. Хрещатик 1', icon: '📍' },
    { key: 'phone', label: 'Телефон', placeholder: '+380 99 999 9999', icon: '📞' },
    { key: 'director', label: 'Директор (П.І.Б.)', placeholder: 'Іваненко Іван Іванович', icon: '👤' },
  ];

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put('/settings', values);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setLoading(false); }
  };

  const isComplete = fields.every(f => values[f.key]?.trim());

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-800">🏢 Реквізити компанії</h2>
          <p className="text-xs text-gray-400 mt-0.5">Використовуються при генерації документів</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          isComplete ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
        }`}>
          {isComplete ? '✓ Заповнено' : '⚠️ Не повністю'}
        </span>
      </div>
      <div className="p-4 space-y-3">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center gap-3">
            <span className="text-lg shrink-0 w-7 text-center">{f.icon}</span>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
              <input value={values[f.key] || ''}
                onChange={(e) => setValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 pb-4">
        <button onClick={handleSave} disabled={loading}
          className={`w-full text-white text-sm px-4 py-2.5 rounded-lg disabled:opacity-50 transition-colors font-medium ${
            saved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'
          }`}>
          {loading ? 'Збереження...' : saved ? '✓ Збережено' : 'Зберегти реквізити'}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Користувачі
// ============================================================
function UsersSettings() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | undefined>();
  const [search, setSearch] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/toggle`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const roleBadge: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-700',
    WORKER: 'bg-blue-100 text-blue-700',
    ACCOUNTANT: 'bg-green-100 text-green-700',
    INSPECTOR: 'bg-orange-100 text-orange-700',
  };
  const roleIcon: Record<string, string> = {
    ADMIN: '👑', WORKER: '🔧', ACCOUNTANT: '📊', INSPECTOR: '🔍',
  };
  const roleLabel: Record<string, string> = {
    ADMIN: 'Адміністратор', WORKER: 'Працівник', ACCOUNTANT: 'Бухгалтер', INSPECTOR: 'Перевірка',
  };
  const avatarColor: Record<string, string> = {
    ADMIN: 'bg-purple-500', WORKER: 'bg-blue-500', ACCOUNTANT: 'bg-green-500', INSPECTOR: 'bg-orange-500',
  };

  const filtered = users.filter((u: User) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );
  const activeCount = users.filter((u: User) => u.isActive).length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-gray-800">👥 Користувачі</h2>
            <p className="text-xs text-gray-400 mt-0.5">Активних: {activeCount} з {users.length}</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
            + Додати
          </button>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Пошук за іменем або email..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="divide-y divide-gray-100">
        {isLoading ? (
          <div className="text-center text-gray-400 py-8">Завантаження...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-8 text-sm">Не знайдено</div>
        ) : filtered.map((user: User) => (
          <div key={user.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${!user.isActive ? 'opacity-50' : ''}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${avatarColor[user.role]}`}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-800">{user.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge[user.role]}`}>
                  {roleIcon[user.role]} {roleLabel[user.role]}
                </span>
                {!user.isActive && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Неактивний</span>}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{user.email}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setEditUser(user)} className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors">Редагувати</button>
              {user.role !== 'ADMIN' && (
                <button onClick={() => toggleMutation.mutate(user.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${user.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                  {user.isActive ? 'Деактивувати' : 'Активувати'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {showCreate && <UserModal onClose={() => setShowCreate(false)} />}
      {editUser && <UserModal user={editUser} onClose={() => setEditUser(undefined)} />}
    </div>
  );
}

// ============================================================
// Універсальна секція для постачальників / водіїв / авто
// ============================================================
type SimpleItem = { id: string; name?: string; number?: string; brand?: string; edrpou?: string; contact?: string; isActive: boolean };

function SimpleListSection({
  title,
  icon,
  queryKey,
  fetchUrl,
  createUrl,
  updateUrl,
  toggleUrl,
  emptyLabel,
  renderItem,
  renderForm,
  formFields,
}: {
  title: string;
  icon: string;
  queryKey: string;
  fetchUrl: string;
  createUrl: string;
  updateUrl: (id: string) => string;
  toggleUrl: (id: string) => string;
  emptyLabel: string;
  renderItem: (item: SimpleItem) => React.ReactNode;
  renderForm: (vals: Record<string, string>, setVals: (v: Record<string, string>) => void) => React.ReactNode;
  formFields: { key: string; required?: boolean }[];
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<SimpleItem | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState('');

  const { data: items = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: () => api.get(fetchUrl).then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(toggleUrl(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
  });

  const openCreate = () => {
    setEditItem(null);
    setVals({});
    setError('');
    setShowForm(true);
  };

  const openEdit = (item: SimpleItem) => {
    setEditItem(item);
    setVals(Object.fromEntries(
      formFields.map(f => [f.key, (item as any)[f.key] || ''])
    ));
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    const requiredField = formFields.find(f => f.required && !vals[f.key]?.trim());
    if (requiredField) return setError(`Поле обов'язкове`);
    setLoading(true); setError('');
    try {
      if (editItem) {
        await api.patch(updateUrl(editItem.id), vals);
      } else {
        await api.post(createUrl, vals);
      }
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setShowForm(false);
      setEditItem(null);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Помилка збереження');
    } finally {
      setLoading(false); }
  };

  const activeCount = items.filter((i: SimpleItem) => i.isActive).length;
  const inactiveCount = items.filter((i: SimpleItem) => !i.isActive).length;

  const filtered = items.filter((i: SimpleItem) => {
    const text = Object.values(i).join(' ').toLowerCase();
    const matchSearch = !search || text.includes(search.toLowerCase());
    const matchActive = showInactive ? true : i.isActive;
    return matchSearch && matchActive;
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Шапка */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-gray-800">{icon} {title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Активних: {activeCount}
              {inactiveCount > 0 && ` · Неактивних: ${inactiveCount}`}
            </p>
          </div>
          <div className="flex gap-2">
            {inactiveCount > 0 && (
              <button onClick={() => setShowInactive(v => !v)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                  showInactive ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}>
                {showInactive ? 'Сховати архів' : `Архів (${inactiveCount})`}
              </button>
            )}
            <button onClick={openCreate}
              className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
              + Додати
            </button>
          </div>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Пошук..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Форма */}
      {showForm && (
        <div className="p-4 border-b bg-blue-50 space-y-3">
          <div className="text-xs font-semibold text-blue-700 mb-2">
            {editItem ? 'Редагувати' : 'Новий запис'}
          </div>
          {renderForm(vals, setVals)}
          {error && <div className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); setEditItem(null); }}
              className="flex-1 border border-gray-300 text-gray-600 text-sm px-3 py-2 rounded-lg hover:bg-gray-50">
              Скасувати
            </button>
            <button onClick={handleSave} disabled={loading}
              className="flex-1 bg-blue-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Збереження...' : 'Зберегти'}
            </button>
          </div>
        </div>
      )}

      {/* Список */}
      <div className="divide-y divide-gray-100">
        {isLoading ? (
          <div className="text-center text-gray-400 py-8">Завантаження...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-3xl mb-2">{icon}</div>
            <div className="text-sm text-gray-500">{search ? 'Не знайдено' : emptyLabel}</div>
            {!search && (
              <button onClick={openCreate} className="mt-2 text-xs text-blue-500 hover:text-blue-700">
                + Додати першого
              </button>
            )}
          </div>
        ) : filtered.map((item: SimpleItem) => (
          <div key={item.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${!item.isActive ? 'opacity-50' : ''}`}>
            <div className="flex-1 min-w-0">{renderItem(item)}</div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => openEdit(item)}
                className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                Редагувати
              </button>
              <button onClick={() => toggleMutation.mutate(item.id)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  item.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                }`}>
                {item.isActive ? 'Деактивувати' : 'Активувати'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Головна сторінка налаштувань
// ============================================================
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'company' | 'users' | 'suppliers' | 'drivers' | 'cars'>('company');

  const tabs = [
    { value: 'company',   label: '🏢 Реквізити' },
    { value: 'users',     label: '👥 Користувачі' },
    { value: 'suppliers', label: '🏭 Постачальники' },
    { value: 'drivers',   label: '🚗 Водії' },
    { value: 'cars',      label: '🚛 Авто' },
  ];

  return (
    <div className="space-y-4 max-w-2xl pb-8">
      <h1 className="text-xl font-bold text-gray-800">Налаштування</h1>

      <div className="flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value as typeof activeTab)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              activeTab === tab.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'company' && <CompanySettings />}
      {activeTab === 'users' && <UsersSettings />}

      {activeTab === 'suppliers' && (
        <SimpleListSection
          title="Постачальники" icon="🏭"
          queryKey="suppliers" fetchUrl="/warehouses/suppliers"
          createUrl="/warehouses/suppliers"
          updateUrl={(id) => `/warehouses/suppliers/${id}`}
          toggleUrl={(id) => `/warehouses/suppliers/${id}/toggle`}
          emptyLabel="Постачальників ще немає"
          formFields={[
            { key: 'name', required: true },
            { key: 'edrpou' },
            { key: 'contact' },
          ]}
          renderForm={(vals, setVals) => (
            <div className="space-y-2">
              <input value={vals.name || ''} onChange={(e) => setVals({ ...vals, name: e.target.value })}
                placeholder="Назва *" autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="grid grid-cols-2 gap-2">
                <input value={vals.edrpou || ''} onChange={(e) => setVals({ ...vals, edrpou: e.target.value })}
                  placeholder="ЄДРПОУ"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input value={vals.contact || ''} onChange={(e) => setVals({ ...vals, contact: e.target.value })}
                  placeholder="Контакт"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}
          renderItem={(item) => (
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold shrink-0">
                  {(item.name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-800">{item.name}</div>
                  <div className="flex gap-3">
                    {(item as any).edrpou && <span className="text-xs text-gray-400">📋 {(item as any).edrpou}</span>}
                    {(item as any).contact && <span className="text-xs text-gray-400">📞 {(item as any).contact}</span>}
                  </div>
                </div>
              </div>
            </div>
          )}
        />
      )}

      {activeTab === 'drivers' && (
        <SimpleListSection
          title="Водії" icon="🚗"
          queryKey="drivers" fetchUrl="/drivers"
          createUrl="/drivers"
          updateUrl={(id) => `/drivers/${id}`}
          toggleUrl={(id) => `/drivers/${id}/toggle`}
          emptyLabel="Водіїв ще немає"
          formFields={[{ key: 'name', required: true }]}
          renderForm={(vals, setVals) => (
            <input value={vals.name || ''} onChange={(e) => setVals({ ...vals, name: e.target.value })}
              placeholder="Прізвище І.П. *" autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          )}
          renderItem={(item) => (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
                {(item.name || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-800">{item.name}</div>
                {!item.isActive && <div className="text-xs text-gray-400">Неактивний</div>}
              </div>
            </div>
          )}
        />
      )}

      {activeTab === 'cars' && (
        <SimpleListSection
          title="Автомобілі" icon="🚛"
          queryKey="cars" fetchUrl="/cars"
          createUrl="/cars"
          updateUrl={(id) => `/cars/${id}`}
          toggleUrl={(id) => `/cars/${id}/toggle`}
          emptyLabel="Автомобілів ще немає"
          formFields={[
            { key: 'number', required: true },
            { key: 'brand' },
          ]}
          renderForm={(vals, setVals) => (
            <div className="grid grid-cols-2 gap-2">
              <input value={vals.number || ''} onChange={(e) => setVals({ ...vals, number: e.target.value })}
                placeholder="Держ. номер *" autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input value={vals.brand || ''} onChange={(e) => setVals({ ...vals, brand: e.target.value })}
                placeholder="Марка авто"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          renderItem={(item) => (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center text-lg shrink-0">
                🚛
              </div>
              <div>
                <div className="text-sm font-bold text-gray-800">{item.number}</div>
                {(item as any).brand && <div className="text-xs text-gray-400">{(item as any).brand}</div>}
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}