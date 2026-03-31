import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { useAuthStore } from '@/store/auth';
import { Product } from '@/types';

type Category = 'FISH' | 'SUPPLY';

const getProductIcon = (name: string, category?: string): string => {
  if (category === 'SUPPLY') {
    const n = name.toLowerCase();
    if (n.includes('банк') || n.includes('скло') || n.includes('jar')) return '🫙';
    if (n.includes('вакуум') || n.includes('пакет') || n.includes('плівк')) return '📦';
    if (n.includes('хімі') || n.includes('мийн') || n.includes('дезінф')) return '🧴';
    if (n.includes('кришк') || n.includes('кришка')) return '🔩';
    if (n.includes('стрічк') || n.includes('скотч')) return '🎞️';
    if (n.includes('рукавич')) return '🧤';
    if (n.includes('сіль')) return '🧂';
    if (n.includes('спеці') || n.includes('перець')) return '🌶️';
    return '🧴';
  }
  const n = name.toLowerCase();
  if (n.includes('скумбрія') || n.includes('макрель')) return '🐟';
  if (n.includes('оселедець')) return '🐠';
  if (n.includes('лосось') || n.includes('сьомга')) return '🍣';
  if (n.includes('тріска') || n.includes('минтай')) return '🐡';
  if (n.includes('карп') || n.includes('короп')) return '🐟';
  if (n.includes('судак') || n.includes('щука')) return '🎣';
  if (n.includes('копч')) return '♨️';
  if (n.includes('солен') || n.includes('посол')) return '🧂';
  if (n.includes('консерв')) return '🥫';
  return '🐟';
};

const CATEGORY_CONFIG: Record<Category, { label: string; icon: string; color: string; bg: string; border: string }> = {
  FISH:   { label: 'Риба',       icon: '🐟', color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  SUPPLY: { label: 'Матеріали',  icon: '🧴', color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
};

// ─── ProductModal ─────────────────────────────────────────────────────────────
function ProductModal({ product, onClose }: { product?: Product; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(product?.name || '');
  const [unit, setUnit] = useState(product?.unit || 'кг');
  const [category, setCategory] = useState<Category>((product as any)?.category || 'FISH');
  const [storageTemp, setStorageTemp] = useState((product as any)?.storageTemp || '');
  const [storageDays, setStorageDays] = useState(String((product as any)?.storageDays || ''));
  const [storageHumidity, setStorageHumidity] = useState((product as any)?.storageHumidity || '');
  const [storageStandard, setStorageStandard] = useState((product as any)?.storageStandard || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) return setError('Вкажіть назву продукту');
    setLoading(true); setError('');
    try {
      const payload = {
        name, unit, category,
        storageTemp: storageTemp || undefined,
        storageDays: storageDays ? Number(storageDays) : undefined,
        storageHumidity: storageHumidity || undefined,
        storageStandard: storageStandard || undefined,
      };
      if (product) {
        await api.patch(`/products/${product.id}`, payload);
      } else {
        await api.post('/products', payload);
      }
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-active'] });
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Помилка збереження');
    } finally { setLoading(false); }
  };

  const cfg = CATEGORY_CONFIG[category];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-800">{product ? 'Редагувати продукт' : 'Новий продукт'}</h2>
        </div>
        <div className="p-4 space-y-4">

          {/* Категорія */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Категорія</label>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
              {(Object.entries(CATEGORY_CONFIG) as [Category, typeof CATEGORY_CONFIG[Category]][]).map(([val, cfg]) => (
                <button key={val} onClick={() => { setCategory(val); setUnit(val === 'SUPPLY' ? 'шт' : 'кг'); }}
                  className={`flex-1 py-2.5 font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                    category === val ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}>
                  {cfg.icon} {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Назва */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Назва *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">{getProductIcon(name, category)}</span>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={category === 'SUPPLY' ? 'Вакуумна упаковка 500мл' : 'Скумбрія холодного копчення'}
                autoFocus />
            </div>
          </div>

          {/* Одиниця */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Одиниця виміру</label>
            <div className="grid grid-cols-5 gap-1.5">
              {['кг', 'г', 'шт', 'л', 'уп'].map((u) => (
                <button key={u} onClick={() => setUnit(u)}
                  className={`py-2 rounded-lg text-sm border transition-colors ${
                    unit === u ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}>
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Умови зберігання */}
          <div className="border border-gray-100 rounded-xl p-3 space-y-3 bg-gray-50">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              🌡️ Умови зберігання <span className="text-gray-400 normal-case font-normal">— необов'язково</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Температура (°C)</label>
                <input
                  value={storageTemp}
                  onChange={(e) => setStorageTemp(e.target.value)}
                  placeholder="-4 до -8"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Термін (діб)</label>
                <input
                  type="number"
                  min="0"
                  value={storageDays}
                  onChange={(e) => setStorageDays(e.target.value)}
                  placeholder="20"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Вологість (%)</label>
                <input
                  value={storageHumidity}
                  onChange={(e) => setStorageHumidity(e.target.value)}
                  placeholder="75-80"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Норматив</label>
                <input
                  value={storageStandard}
                  onChange={(e) => setStorageStandard(e.target.value)}
                  placeholder="ДСТУ, ГОСТ, ТУ"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>
          </div>

          {error && <div className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
        </div>
        <div className="p-4 border-t flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-xl hover:bg-gray-50">Скасувати</button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Збереження...' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ProductsPage ─────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | undefined>();
  const [showInactive, setShowInactive] = useState(false);
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | Category>('ALL');

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/products').then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/products/${id}/toggle`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });

  const isAdmin = user?.role === 'ADMIN';

  const filtered = products.filter((p: Product) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchActive = showInactive ? true : p.isActive;
    const matchCategory = categoryFilter === 'ALL' ? true : (p as any).category === categoryFilter;
    return matchSearch && matchActive && matchCategory;
  });

  const activeCount = products.filter((p: Product) => p.isActive).length;
  const inactiveCount = products.filter((p: Product) => !p.isActive).length;
  const fishCount = products.filter((p: Product) => p.isActive && (p as any).category !== 'SUPPLY').length;
  const supplyCount = products.filter((p: Product) => p.isActive && (p as any).category === 'SUPPLY').length;

  const grouped = filtered.reduce((acc: Record<string, Product[]>, p: Product) => {
    const key = p.name.charAt(0).toUpperCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Продукція</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Всього активних: {activeCount}
            {fishCount > 0 && ` · 🐟 ${fishCount}`}
            {supplyCount > 0 && ` · 🧴 ${supplyCount}`}
            {inactiveCount > 0 && ` · архів: ${inactiveCount}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            <button onClick={() => setView('grid')} className={`px-3 py-1.5 transition-colors ${view === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>⊞</button>
            <button onClick={() => setView('table')} className={`px-3 py-1.5 transition-colors ${view === 'table' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>☰</button>
          </div>
          {isAdmin && inactiveCount > 0 && (
            <button onClick={() => setShowInactive(v => !v)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${showInactive ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              {showInactive ? 'Сховати архів' : `Архів (${inactiveCount})`}
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setShowCreate(true)}
              className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
              + Новий
            </button>
          )}
        </div>
      </div>

      {/* Пошук і фільтр категорії */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук за назвою..."
            className="w-full border border-gray-300 rounded-lg pl-8 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">×</button>
          )}
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {[
            { value: 'ALL',    label: 'Всі' },
            { value: 'FISH',   label: '🐟 Риба' },
            { value: 'SUPPLY', label: '🧴 Матеріали' },
          ].map((c) => (
            <button key={c.value} onClick={() => setCategoryFilter(c.value as any)}
              className={`px-3 py-1.5 transition-colors whitespace-nowrap ${categoryFilter === c.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Контент */}
      {isLoading ? (
        <div className="text-center text-gray-400 py-12">Завантаження...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <div className="text-4xl mb-3">{categoryFilter === 'SUPPLY' ? '🧴' : '🐟'}</div>
          <div className="font-medium text-gray-500">{search ? 'Продуктів не знайдено' : 'Продуктів ще немає'}</div>
          {isAdmin && !search && (
            <button onClick={() => setShowCreate(true)} className="mt-3 text-blue-500 text-sm hover:text-blue-700">+ Додати перший продукт</button>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className="space-y-4">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b, 'uk'))
            .map(([letter, prods]) => (
              <div key={letter}>
                {!search && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center">{letter}</div>
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-xs text-gray-400">{prods.length}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {prods.map((product: Product) => {
                    const cat = (product as any).category as Category ?? 'FISH';
                    const cfg = CATEGORY_CONFIG[cat];
                    return (
                      <div key={product.id}
                        className={`bg-white rounded-xl border p-3 transition-all group ${product.isActive ? 'border-gray-200 hover:border-blue-200 hover:shadow-sm' : 'border-gray-100 opacity-50'}`}>
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-2xl">{getProductIcon(product.name, cat)}</span>
                          <div className="flex flex-row items-end gap-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color} ${cfg.border} border`}>
                              {cfg.icon} {cfg.label}
                            </span>
                            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{product.unit}</span>
                            
                          </div>
                        </div>
                        <div className="text-sm font-medium text-gray-800 leading-tight mb-3 line-clamp-2">{product.name}</div>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${product.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {product.isActive ? 'Активний' : 'Архів'}
                          </span>
                          {isAdmin && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setEditProduct(product)}
                                className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100">✏️</button>
                              <button onClick={() => toggleMutation.mutate(product.id)}
                                className={`text-xs px-2 py-1 rounded transition-colors ${product.isActive ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                                {product.isActive ? '🗃️' : '✓'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs text-gray-500">
                <th className="px-4 py-3 font-medium">Продукт</th>
                <th className="px-4 py-3 font-medium">Категорія</th>
                <th className="px-4 py-3 font-medium">Одиниця</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                {isAdmin && <th className="px-4 py-3 font-medium text-right">Дії</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((product: Product) => {
                const cat = (product as any).category as Category ?? 'FISH';
                const cfg = CATEGORY_CONFIG[cat];
                return (
                  <tr key={product.id} className={`hover:bg-gray-50 transition-colors ${!product.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getProductIcon(product.name, cat)}</span>
                        <span className="font-medium text-gray-800">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-xs text-gray-600">{product.unit}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${product.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {product.isActive ? 'Активний' : 'Архів'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setEditProduct(product)}
                            className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100">Редагувати</button>
                          <button onClick={() => toggleMutation.mutate(product.id)}
                            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${product.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                            {product.isActive ? 'Деактивувати' : 'Активувати'}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <ProductModal onClose={() => setShowCreate(false)} />}
      {editProduct && <ProductModal product={editProduct} onClose={() => setEditProduct(undefined)} />}
    </div>
  );
}