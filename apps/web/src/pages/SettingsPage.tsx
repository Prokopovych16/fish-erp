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
    WORKER: 'Kanban дошка, фактична вага, справи',
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 to-blue-600">
          <h2 className="font-bold text-white">
            {user ? '✏️ Редагувати користувача' : '➕ Новий користувач'}
          </h2>
        </div>
        <div className="p-5 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Ім'я *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Іван Іваненко" />
          </div>
          {!user && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ivan@fish-erp.com" />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Роль</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Object.entries(roleLabel).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <div className="text-xs text-gray-400 mt-1.5 pl-1">{roleDesc[role]}</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Пароль {user && <span className="text-gray-400 normal-case font-normal">(порожньо = не змінювати)</span>}
            </label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••" />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          {error && <div className="text-red-500 text-sm bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">⚠️ {error}</div>}
        </div>
        <div className="p-5 pt-0 flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">Скасувати</button>
          <button onClick={handleSave} disabled={loading} className="flex-1 bg-blue-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-semibold transition-colors">
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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-lg shadow-md shadow-blue-200 shrink-0">🏢</div>
          <div>
            <h2 className="font-bold text-gray-800">Реквізити компанії</h2>
            <p className="text-xs text-gray-400 mt-0.5">Використовуються при генерації документів</p>
          </div>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${
          isComplete ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'
        }`}>
          {isComplete ? '✓ Заповнено' : '⚠️ Не повністю'}
        </span>
      </div>
      <div className="p-5 space-y-3.5">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-base shrink-0">{f.icon}</div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{f.label}</label>
              <input value={values[f.key] || ''}
                onChange={(e) => setValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        ))}
      </div>
      <div className="px-5 pb-5">
        <button onClick={handleSave} disabled={loading}
          className={`w-full text-white text-sm px-4 py-2.5 rounded-xl disabled:opacity-50 transition-all font-semibold shadow-md ${
            saved ? 'bg-emerald-500 shadow-emerald-200' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 shadow-blue-200'
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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-lg shadow-md shadow-purple-200 shrink-0">👥</div>
            <div>
              <h2 className="font-bold text-gray-800">Користувачі</h2>
              <p className="text-xs text-gray-400 mt-0.5">Активних: {activeCount} з {users.length}</p>
            </div>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm px-3.5 py-2 rounded-xl hover:opacity-90 transition-all font-semibold shadow-md shadow-blue-200 shrink-0">
            + Додати
          </button>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs">🔍</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук за іменем або email..."
            className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
        </div>
      </div>
      <div className="divide-y divide-gray-50">
        {isLoading ? (
          <div className="text-center text-gray-400 py-10">Завантаження...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-10 text-sm">Не знайдено</div>
        ) : filtered.map((user: User) => (
          <div key={user.id} className={`flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-gray-50/70 transition-colors ${!user.isActive ? 'opacity-50' : ''}`}>
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm ${avatarColor[user.role]}`}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-gray-800">{user.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${roleBadge[user.role]}`}>
                  {roleIcon[user.role]} {roleLabel[user.role]}
                </span>
                {!user.isActive && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Неактивний</span>}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{user.email}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setEditUser(user)} className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-xl hover:bg-gray-200 transition-colors font-medium">Редагувати</button>
              {user.role !== 'ADMIN' && (
                <button onClick={() => toggleMutation.mutate(user.id)}
                  className={`text-xs px-3 py-1.5 rounded-xl transition-colors font-medium ${user.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Шапка */}
      <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-lg shadow-md shadow-emerald-200 shrink-0">{icon}</div>
            <div>
              <h2 className="font-bold text-gray-800">{title}</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Активних: {activeCount}
                {inactiveCount > 0 && ` · Неактивних: ${inactiveCount}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {inactiveCount > 0 && (
              <button onClick={() => setShowInactive(v => !v)}
                className={`text-xs px-2.5 py-2 rounded-xl border transition-colors font-medium ${
                  showInactive ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}>
                {showInactive ? 'Сховати архів' : `Архів (${inactiveCount})`}
              </button>
            )}
            <button onClick={openCreate}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm px-3.5 py-2 rounded-xl hover:opacity-90 transition-all font-semibold shadow-md shadow-blue-200">
              + Додати
            </button>
          </div>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs">🔍</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук..."
            className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
        </div>
      </div>

      {/* Форма */}
      {showForm && (
        <div className="p-5 border-b border-gray-100 bg-blue-50/50 space-y-3">
          <div className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">
            {editItem ? '✏️ Редагувати' : '➕ Новий запис'}
          </div>
          {renderForm(vals, setVals)}
          {error && <div className="text-red-500 text-xs bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">⚠️ {error}</div>}
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); setEditItem(null); }}
              className="flex-1 border border-gray-200 text-gray-600 text-sm px-3 py-2.5 rounded-xl hover:bg-white transition-colors">
              Скасувати
            </button>
            <button onClick={handleSave} disabled={loading}
              className="flex-1 bg-blue-600 text-white text-sm px-3 py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-semibold transition-colors">
              {loading ? 'Збереження...' : 'Зберегти'}
            </button>
          </div>
        </div>
      )}

      {/* Список */}
      <div className="divide-y divide-gray-50">
        {isLoading ? (
          <div className="text-center text-gray-400 py-10">Завантаження...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-2 opacity-40">{icon}</div>
            <div className="text-sm text-gray-500 font-medium">{search ? 'Не знайдено' : emptyLabel}</div>
            {!search && (
              <button onClick={openCreate} className="mt-2 text-xs text-blue-500 hover:text-blue-700 font-medium">
                + Додати першого
              </button>
            )}
          </div>
        ) : filtered.map((item: SimpleItem) => (
          <div key={item.id} className={`flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/70 transition-colors ${!item.isActive ? 'opacity-50' : ''}`}>
            <div className="flex-1 min-w-0">{renderItem(item)}</div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => openEdit(item)}
                className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-xl hover:bg-gray-200 transition-colors font-medium">
                Редагувати
              </button>
              <button onClick={() => toggleMutation.mutate(item.id)}
                className={`text-xs px-3 py-1.5 rounded-xl transition-colors font-medium ${
                  item.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
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
// Перевізник
// ============================================================
function CarrierSettings() {
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
    { key: 'carrierName', label: 'Назва перевізника', placeholder: 'ФОП Іваненко Іван Іванович', icon: '🚚' },
    { key: 'carrierEdrpou', label: 'ЄДРПОУ / ДРФО перевізника', placeholder: '12345678', icon: '📋' },
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

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-lg shadow-md shadow-orange-200 shrink-0">🚚</div>
        <div>
          <h2 className="font-bold text-gray-800">Автомобільний перевізник</h2>
          <p className="text-xs text-gray-400 mt-0.5">Підставляється в ТТН. Водій вказується окремо в заявці.</p>
        </div>
      </div>
      <div className="p-5 space-y-3.5">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-base shrink-0">{f.icon}</div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{f.label}</label>
              <input value={values[f.key] || ''}
                onChange={(e) => setValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        ))}
      </div>
      <div className="px-5 pb-5">
        <button onClick={handleSave} disabled={loading}
          className={`w-full text-sm px-4 py-2.5 rounded-xl font-semibold transition-all shadow-md disabled:opacity-50 ${saved ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-90 shadow-blue-200'}`}>
          {saved ? '✓ Збережено' : loading ? 'Збереження...' : 'Зберегти'}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Резервна копія БД
// ============================================================
function BackupSettings() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleBackup = async () => {
    setLoading(true); setError(''); setDone(false);
    try {
      const res = await api.get('/settings/backup', { responseType: 'blob' });
      const date = new Date().toISOString().slice(0, 10);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/sql' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `fish-erp-backup-${date}.sql`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (e) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Помилка створення резервної копії');
    } finally { setLoading(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-600 to-gray-800 flex items-center justify-center text-lg shadow-md shadow-gray-300 shrink-0">💾</div>
        <div>
          <h2 className="font-bold text-gray-800">Резервна копія бази даних</h2>
          <p className="text-xs text-gray-400 mt-0.5">Повний дамп БД у форматі .sql — можна зберегти локально на компʼютер</p>
        </div>
      </div>
      <div className="p-5 space-y-3.5">
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700 flex items-start gap-2">
          <span className="text-base shrink-0">💡</span>
          <span>Рекомендується робити копію регулярно (напр. раз на тиждень) і зберігати її окремо від сервера — на компʼютері, флешці чи в хмарі.</span>
        </div>
        {error && <div className="text-red-500 text-sm bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">⚠️ {error}</div>}
        <button onClick={handleBackup} disabled={loading}
          className={`w-full text-white text-sm px-4 py-2.5 rounded-xl disabled:opacity-50 transition-all font-semibold shadow-md flex items-center justify-center gap-2 ${
            done ? 'bg-emerald-500 shadow-emerald-200' : 'bg-gradient-to-r from-slate-700 to-gray-900 hover:opacity-90 shadow-gray-300'
          }`}>
          {loading ? (<><span className="animate-spin">⏳</span> Створюю копію...</>) : done ? '✓ Завантажено' : '⬇️ Завантажити резервну копію'}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Головна сторінка налаштувань
// ============================================================
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'company' | 'users' | 'suppliers' | 'drivers' | 'cars' | 'carrier' | 'backup'>('company');

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  const tabs = [
    { value: 'company',   label: 'Реквізити', icon: '🏢' },
    { value: 'users',     label: 'Користувачі', icon: '👥' },
    { value: 'suppliers', label: 'Постачальники', icon: '🏭' },
    { value: 'drivers',   label: 'Водії', icon: '🚗' },
    { value: 'cars',      label: 'Авто', icon: '🚛' },
    { value: 'carrier',   label: 'Перевізник', icon: '🚚' },
    { value: 'backup',    label: 'Резервна копія', icon: '💾' },
  ];

  return (
    <div className="space-y-5 max-w-2xl pb-8">
      {/* Шапка */}
      <div className="bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 rounded-2xl sm:rounded-3xl border border-gray-100 p-3.5 sm:p-5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-700 to-gray-900 flex items-center justify-center text-xl shadow-md shadow-gray-300">⚙️</div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">Налаштування</h1>
            <p className="text-sm text-gray-400">{(users as User[]).length} користувачів · реквізити · довідники</p>
          </div>
        </div>
      </div>

      {/* Таби */}
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((tab) => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value as typeof activeTab)}
            className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${
              activeTab === tab.value
                ? 'bg-gray-900 text-white shadow-md'
                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}>
            <span>{tab.icon}</span>{tab.label}
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

      {activeTab === 'carrier' && <CarrierSettings />}
      {activeTab === 'backup' && <BackupSettings />}
    </div>
  );
}