import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { useAuthStore } from '@/store/auth';
import { ProductionModal } from '@/pages/ProductionModal';
import { ReturnModal } from '@/pages/ReturnModal';


type MovementType = 'IN' | 'OUT' | 'TRANSFER' | 'PRODUCTION' | 'ADJUSTMENT';
type WarehouseType = 'RAW_MATERIAL' | 'IN_PRODUCTION' | 'FINISHED_GOODS' | 'FRIDGE' | 'SUPPLIES';
type FormType = 'FORM_1' | 'FORM_2';

const VAT_RATE = 0.2;

const warehouseTypeLabel: Record<WarehouseType, string> = {
  RAW_MATERIAL: 'Сировина', IN_PRODUCTION: 'У виробництві',
  FINISHED_GOODS: 'Готова продукція', FRIDGE: 'Холодильник',
  SUPPLIES: 'Витратні матеріали',
};
const warehouseTypeIcon: Record<WarehouseType, string> = {
  RAW_MATERIAL: '🐟', IN_PRODUCTION: '⚙️', FINISHED_GOODS: '📦', FRIDGE: '❄️', SUPPLIES: '🧴',
};
const warehouseTypeColor: Record<WarehouseType, string> = {
  RAW_MATERIAL: 'from-blue-500 to-blue-600',
  IN_PRODUCTION: 'from-yellow-500 to-orange-500',
  FINISHED_GOODS: 'from-green-500 to-emerald-600',
  FRIDGE: 'from-cyan-500 to-blue-500',
  SUPPLIES: 'from-amber-500 to-yellow-500',
};
const movementTypeLabel: Record<MovementType, string> = {
  IN: 'Надходження', OUT: 'Списання', TRANSFER: 'Переміщення',
  PRODUCTION: 'Виробництво', ADJUSTMENT: 'Ревізія',
};
const movementTypeColor: Record<MovementType, string> = {
  IN: 'bg-green-100 text-green-700', OUT: 'bg-red-100 text-red-700',
  TRANSFER: 'bg-blue-100 text-blue-700', PRODUCTION: 'bg-purple-100 text-purple-700',
  ADJUSTMENT: 'bg-orange-100 text-orange-700',
};
const movementTypeIcon: Record<MovementType, string> = {
  IN: '↓', OUT: '↑', TRANSFER: '↔', PRODUCTION: '⚙', ADJUSTMENT: '⚖',
};


// ─── EditStockItemModal ───────────────────────────────────────────────────────
function EditStockItemModal({ item, onClose, onSaved }: {
  item: any; onClose: () => void; onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [supplierId, setSupplierId] = useState(item.supplierId || '');
  const [pricePerKg, setPricePerKg] = useState(item.pricePerKg ? String(Number(item.pricePerKg)) : '');
  const [arrivedAt, setArrivedAt] = useState(
    item.arrivedAt ? new Date(item.arrivedAt).toISOString().slice(0, 10) : '',
  );
  const [quantity, setQuantity] = useState(String(Number(item.quantity)));
  const [note, setNote] = useState(item.note || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/warehouses/suppliers').then((r) => r.data),
  });

  const priceNum = Number(pricePerKg) || 0;
  const qtyNum = Number(quantity) || 0;

  const handleSave = async () => {
    if (!quantity || Number(quantity) <= 0) return setError('Кількість має бути більше 0');
    setLoading(true); setError('');
    try {
      await api.patch(`/warehouses/stock-items/${item.id}`, {
        supplierId: supplierId || null,
        pricePerKg: pricePerKg ? Number(pricePerKg) : null,
        arrivedAt: arrivedAt || undefined,
        quantity: Number(quantity),
        note: note || null,
      });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['incoming-movements'] });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Помилка збереження');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-gray-800">Редагування партії</h2>
            <p className="text-xs text-gray-400 mt-0.5">{item.product?.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Постачальник</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Без постачальника</option>
              {(suppliers as any[]).filter((s: any) => s.isActive).map((s: any) =>
                <option key={s.id} value={s.id}>🏭 {s.name}</option>
              )}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Кількість ({item.product?.unit || 'кг'})
              </label>
              <input type="number" step="0.001" min="0.001" value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Ціна/кг (з ПДВ)</label>
              <input type="number" step="0.01" min="0" value={pricePerKg}
                onChange={(e) => setPricePerKg(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
            </div>
          </div>
          {priceNum > 0 && qtyNum > 0 && (
            <div className="grid grid-cols-2 gap-2 bg-blue-50 rounded-xl p-3">
              <div className="text-center">
                <div className="text-[10px] text-gray-400 mb-0.5">Без ПДВ</div>
                <div className="text-sm font-bold text-gray-700">{(priceNum / 1.2).toFixed(2)} ₴/кг</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-gray-400 mb-0.5">Сума з ПДВ</div>
                <div className="text-sm font-bold text-green-600">{(priceNum * qtyNum).toFixed(2)} ₴</div>
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Дата надходження</label>
            <input type="date" value={arrivedAt} onChange={(e) => setArrivedAt(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Коментар</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Необов'язково..." />
          </div>
          {error && <div className="text-red-500 text-sm bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">⚠️ {error}</div>}
        </div>
        <div className="px-5 pb-5 pt-4 border-t flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50">Скасувати</button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 bg-blue-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-bold">
            {loading ? 'Зберігаю...' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── WarehouseModal ───────────────────────────────────────────────────────────
function freshnessBadge(arrivedAt: string): { label: string; cls: string } {
  const days = Math.floor((Date.now() - new Date(arrivedAt).getTime()) / 86400000);
  if (days <= 1) return { label: 'сьогодні', cls: 'bg-emerald-50 text-emerald-600' };
  if (days <= 3) return { label: `${days} дн.`, cls: 'bg-emerald-50 text-emerald-600' };
  if (days <= 7) return { label: `${days} дн.`, cls: 'bg-amber-50 text-amber-600' };
  return { label: `${days} дн.`, cls: 'bg-red-50 text-red-500' };
}

function WarehouseModal({ warehouse, onClose, onMovement, onProduction }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warehouse: any; onClose: () => void; onMovement: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onProduction: (item: any) => void;
}) {
  const { user } = useAuthStore();
  const isInspector = user?.role === 'INSPECTOR';
  const isAdmin = user?.role === 'ADMIN';
  const [formFilter, setFormFilter] = useState<'ALL' | 'FORM_1' | 'FORM_2'>(isInspector ? 'FORM_1' : 'ALL');
  const [search, setSearch] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const items = warehouse.stockItems || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filtered = (formFilter === 'ALL' ? items : items.filter((i: any) => i.form === formFilter))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((i: any) => Number(i.quantity) > 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((i: any) => !search || i.product.name.toLowerCase().includes(search.toLowerCase()))
    // Найновіші партії — першими
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .sort((a: any, b: any) => new Date(b.arrivedAt).getTime() - new Date(a.arrivedAt).getTime());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalSum = filtered.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.pricePerKg ?? 0), 0);
  const totalSumNoVat = totalSum / (1 + VAT_RATE);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalKg = filtered.filter((i: any) => i.product.unit === 'кг').reduce((s: number, i: any) => s + Number(i.quantity), 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalPcs = filtered.filter((i: any) => i.product.unit === 'шт').reduce((s: number, i: any) => s + Number(i.quantity), 0);
  const type = warehouse.type as WarehouseType;

  // Групуємо по продукту, всередині групи лишається сортування найновіше → найстаріше
  const groups = Object.entries(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filtered.reduce((acc: Record<string, any[]>, item: any) => {
      const key = item.product.name;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as [string, any[]][];
  // Сортуємо групи продуктів за датою найновішої партії
  groups.sort(([, a], [, b]) => new Date(b[0].arrivedAt).getTime() - new Date(a[0].arrivedAt).getTime());

  return (
    <>
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">

        {/* ── Шапка ── */}
        <div className={`bg-gradient-to-br ${warehouseTypeColor[type] || 'from-gray-500 to-gray-600'} px-6 py-5 shrink-0 relative overflow-hidden`}>
          <div className="absolute -right-6 -top-10 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute right-16 -bottom-12 w-28 h-28 rounded-full bg-white/10" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl shadow-inner shrink-0">
                {warehouseTypeIcon[type] || '🏭'}
              </div>
              <div>
                <h2 className="font-bold text-white text-2xl leading-tight">{warehouse.name}</h2>
                <span className="text-white/70 text-sm font-medium">{warehouseTypeLabel[type]}</span>
              </div>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white text-2xl leading-none transition-colors shrink-0">×</button>
          </div>

          <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5">
            {[
              { label: 'Позицій', value: String(filtered.length) },
              { label: 'Обсяг', value: [totalKg > 0 ? `${totalKg.toFixed(1)} кг` : '', totalPcs > 0 ? `${Math.round(totalPcs)} шт` : ''].filter(Boolean).join(' + ') || '0' },
              { label: 'Без ПДВ', value: `${totalSumNoVat.toFixed(0)} ₴` },
              { label: 'З ПДВ', value: `${totalSum.toFixed(0)} ₴` },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2">
                <div className="text-white/60 text-xs uppercase tracking-wide font-semibold">{stat.label}</div>
                <div className="text-white font-bold text-lg leading-tight">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Фільтри ── */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2 shrink-0 flex-wrap">
          {!isInspector && (
            <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm bg-white shadow-sm">
              {[{ value: 'ALL', label: 'Всі' }, { value: 'FORM_1', label: '🏦 Ф1' }, { value: 'FORM_2', label: '💵 Ф2' }].map((f) => (
                <button key={f.value} onClick={() => setFormFilter(f.value as typeof formFilter)}
                  className={`px-3 py-1.5 transition-colors font-medium ${formFilter === f.value ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
          <div className="relative flex-1 min-w-[160px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm">🔍</span>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук по назві..."
              className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white shadow-sm" />
          </div>
          <span className="text-sm text-gray-400 shrink-0 font-medium">{filtered.length} поз. · найновіші вгорі</span>
        </div>

        {/* ── Тіло: картки по продуктах ── */}
        <div className="flex-1 overflow-y-auto bg-gray-50/40 p-4 space-y-3">
          {groups.length === 0 ? (
            <div className="text-center text-gray-400 py-16">
              <div className="text-5xl mb-3 opacity-40">📭</div>
              <div className="font-semibold">Склад порожній</div>
            </div>
          ) : (
            groups.map(([productName, stockItems]) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const productQty = stockItems.reduce((s: number, i: any) => s + Number(i.quantity), 0);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const productSum = stockItems.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.pricePerKg ?? 0), 0);
              const unit = stockItems[0]?.product?.unit || 'кг';
              return (
                <div key={productName} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Заголовок продукту */}
                  <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl shrink-0">🐟</span>
                      <div className="min-w-0">
                        <div className="font-bold text-gray-800 text-base truncate">{productName}</div>
                        <div className="text-[11px] text-gray-400">{stockItems.length} {stockItems.length === 1 ? 'партія' : 'партій'}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-gray-800 text-base">{productQty.toFixed(unit === 'шт' ? 0 : 3)} {unit}</div>
                      {productSum > 0 && <div className="text-emerald-600 font-semibold text-sm">{productSum.toFixed(2)} ₴</div>}
                    </div>
                  </div>

                  {/* Партії */}
                  <div className="divide-y divide-gray-50">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {stockItems.map((item: any, idx: number) => {
                      const qty = Number(item.quantity);
                      const price = Number(item.pricePerKg ?? 0);
                      const priceNoVat = price / (1 + VAT_RATE);
                      const sumWithVat = qty * price;
                      const fresh = freshnessBadge(item.arrivedAt);
                      return (
                        <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50/30 transition-colors group">
                          {idx === 0 && (
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400" title="Найновіша партія" />
                          )}
                          {idx !== 0 && <span className="shrink-0 w-1.5" />}

                          <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-md font-bold ${item.form === 'FORM_1' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                            {item.form === 'FORM_1' ? 'Ф1' : 'Ф2'}
                          </span>

                          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold ${fresh.cls}`}>
                            {new Date(item.arrivedAt).toLocaleDateString('uk-UA')} · {fresh.label}
                          </span>

                          <span className="text-sm text-gray-400 truncate w-20 shrink-0">
                            {item.supplier?.name
                              ? <span className="text-purple-500 font-medium">🏭 {item.supplier.name}</span>
                              : <span className="text-gray-300">—</span>}
                          </span>

                          <span className="shrink-0 font-bold text-gray-800 text-base">
                            {qty.toFixed(item.product.unit === 'шт' ? 0 : 3)}
                            <span className="text-xs font-normal text-gray-400 ml-0.5">{item.product.unit}</span>
                          </span>

                          <span className="flex-1 text-right text-sm min-w-[90px]">
                            {price > 0 ? (
                              <>
                                <div className="font-semibold text-gray-700">{price.toFixed(2)} ₴/кг</div>
                                <div className="text-gray-400 text-xs">{priceNoVat.toFixed(2)} б/ПДВ</div>
                              </>
                            ) : <span className="text-gray-300">—</span>}
                          </span>

                          <span className="shrink-0 text-right w-20 text-sm font-bold text-emerald-600">
                            {sumWithVat > 0 ? `${sumWithVat.toFixed(2)} ₴` : <span className="text-gray-300 font-normal">—</span>}
                          </span>

                          {isAdmin && (
                            <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              {(warehouse.type === 'RAW_MATERIAL' || warehouse.type === 'FRIDGE') && (
                                <button onClick={() => onProduction({ warehouseId: warehouse.id, stockItemId: item.id, quantity: String(qty) })}
                                  title="Провести виробництво з цієї партії"
                                  className="text-gray-400 hover:text-purple-600 w-7 h-7 rounded-lg hover:bg-purple-50 flex items-center justify-center">
                                  ⚙️
                                </button>
                              )}
                              <button onClick={() => setEditingItem(item)}
                                className="text-gray-400 hover:text-blue-600 w-7 h-7 rounded-lg hover:bg-blue-50 flex items-center justify-center">
                                ✏️
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Підсумок + дії ── */}
        <div className="border-t border-gray-100 bg-white px-5 py-3.5 shrink-0 flex items-center gap-3">
          <div className="text-sm text-gray-500">
            Всього: <span className="font-bold text-gray-800">{totalKg > 0 && `${totalKg.toFixed(1)} кг`}{totalKg > 0 && totalPcs > 0 && ' · '}{totalPcs > 0 && `${Math.round(totalPcs)} шт`}</span>
            {totalSum > 0 && <span className="ml-2 font-bold text-emerald-600">{totalSum.toFixed(2)} ₴</span>}
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="border border-gray-200 text-gray-600 text-base px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors font-medium">Закрити</button>
            <button onClick={onMovement} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-base px-5 py-2.5 rounded-xl hover:opacity-90 transition-all font-semibold shadow-md shadow-blue-200">+ Рух товару</button>
          </div>
        </div>
      </div>
    </div>
    {editingItem && (
      <EditStockItemModal item={editingItem} onClose={() => setEditingItem(null)} onSaved={() => setEditingItem(null)} />
    )}
    </>
  );
}








// ─── SupplierInvoiceModal — накладна з кількома товарами ─────────────────────
interface InvoiceItemRow { productId: string; quantity: string; pricePerKg: string }

function SupplierInvoiceModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [warehouseId, setWarehouseId] = useState('');
  const [form, setForm] = useState<FormType>('FORM_1');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<InvoiceItemRow[]>([{ productId: '', quantity: '', pricePerKg: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: warehouses = [] } = useQuery({ queryKey: ['warehouses'], queryFn: () => api.get('/warehouses').then((r) => r.data) });
  const { data: products = [] } = useQuery({ queryKey: ['products-active'], queryFn: () => api.get('/products/active').then((r) => r.data) });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/warehouses/suppliers').then((r) => r.data) });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inWarehouses = (warehouses as any[]).filter((w) => w.isActive && (w.type === 'FRIDGE' || w.type === 'SUPPLIES'));

  const addItem = () => setItems((prev) => [...prev, { productId: '', quantity: '', pricePerKg: '' }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, key: keyof InvoiceItemRow, val: string) =>
    setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));

  // Точно той самий розрахунок, що й на бекенді — щоб попередній перегляд завжди збігався
  const validItems = items.filter((i) => i.productId && Number(i.quantity) > 0 && Number(i.pricePerKg) > 0);
  const totalWithVat = validItems.reduce((s, i) => s + Math.round(Number(i.quantity) * Number(i.pricePerKg) * 100) / 100, 0);
  const totalNoVat = Number((totalWithVat / 1.2).toFixed(2));
  const totalVat = Number((totalWithVat - totalNoVat).toFixed(2));

  const handleSave = async () => {
    if (!supplierId) return setError('Оберіть постачальника');
    if (!warehouseId) return setError('Оберіть склад');
    if (!invoiceDate) return setError('Вкажіть дату накладної');
    if (validItems.length === 0) return setError('Додайте хоча б одну позицію з кількістю і ціною');
    setLoading(true); setError('');
    try {
      await api.post('/supplier-invoices', {
        supplierId, invoiceNumber: invoiceNumber || undefined, invoiceDate, warehouseId, form,
        note: note || undefined,
        items: validItems.map((i) => ({ productId: i.productId, quantity: Number(i.quantity), pricePerKg: Number(i.pricePerKg) })),
      });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['incoming-movements'] });
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Помилка збереження');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b shrink-0 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600">
          <div>
            <h2 className="font-bold text-white text-lg">📄 Накладна постачальника</h2>
            <p className="text-emerald-100 text-xs mt-0.5">Декілька товарів в одній накладній — потрапляє в реєстр постачальників</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Постачальник *</label>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">Оберіть...</option>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(suppliers as any[]).filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>🏭 {s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Склад *</label>
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">Оберіть...</option>
                {inWarehouses.map((w) => <option key={w.id} value={w.id}>{warehouseTypeIcon[w.type as WarehouseType]} {w.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">№ накладної</label>
              <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="напр. 1234"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Дата накладної *</label>
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Форма оплати</label>
              <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
                {(['FORM_1', 'FORM_2'] as FormType[]).map((f) => (
                  <button key={f} onClick={() => setForm(f)}
                    className={`flex-1 py-2 transition-colors text-xs font-medium ${form === f ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    {f === 'FORM_1' ? '🏦 Ф1' : '💵 Ф2'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Позиції */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Товари в накладній</label>
              <button onClick={addItem} className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold">+ Додати товар</button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => {
                const lineTotal = Number(item.quantity) > 0 && Number(item.pricePerKg) > 0
                  ? Math.round(Number(item.quantity) * Number(item.pricePerKg) * 100) / 100 : 0;
                return (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-2.5">
                    <select value={item.productId} onChange={(e) => updateItem(idx, 'productId', e.target.value)}
                      className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                      <option value="">Продукт...</option>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(products as any[]).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input type="number" step="0.001" min="0" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                      placeholder="кг" className="w-20 border border-gray-300 rounded-lg px-2 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                    <input type="number" step="0.01" min="0" value={item.pricePerKg} onChange={(e) => updateItem(idx, 'pricePerKg', e.target.value)}
                      placeholder="₴/кг з ПДВ" className="w-28 border border-gray-300 rounded-lg px-2 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                    <span className="w-20 text-right text-xs font-bold text-emerald-600 shrink-0">{lineTotal > 0 ? `${lineTotal.toFixed(2)}₴` : ''}</span>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0 px-1">×</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Підсумок */}
          {totalWithVat > 0 && (
            <div className="grid grid-cols-3 gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <div className="text-center">
                <div className="text-[10px] text-gray-400 mb-0.5">Без ПДВ</div>
                <div className="text-sm font-bold text-gray-700">{totalNoVat.toFixed(2)} ₴</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-gray-400 mb-0.5">ПДВ 20%</div>
                <div className="text-sm font-bold text-orange-500">{totalVat.toFixed(2)} ₴</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-gray-400 mb-0.5">Сума з ПДВ</div>
                <div className="text-sm font-bold text-emerald-600">{totalWithVat.toFixed(2)} ₴</div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Коментар</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" placeholder="Необов'язково..." />
          </div>

          {error && <div className="text-red-500 text-sm bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">⚠️ {error}</div>}
        </div>

        <div className="px-6 py-4 border-t flex gap-2 shrink-0 bg-gray-50">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-100 transition-colors">Скасувати</button>
          <button onClick={handleSave} disabled={loading}
            className="flex-2 min-w-[160px] bg-emerald-600 text-white text-sm px-6 py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors font-semibold">
            {loading ? 'Збереження...' : '📄 Зберегти накладну'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MovementModal ────────────────────────────────────────────────────────────
function MovementModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT'>('IN');
  const [warehouseId, setWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [comment, setComment] = useState('');
  const [form, setForm] = useState<FormType>('FORM_1');
  const [pricePerKg, setPricePerKg] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [arrivedAt, setArrivedAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: warehouses = [] } = useQuery({ queryKey: ['warehouses'], queryFn: () => api.get('/warehouses').then((r) => r.data) });
  const { data: products = [] } = useQuery({ queryKey: ['products-active'], queryFn: () => api.get('/products/active').then((r) => r.data) });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/warehouses/suppliers').then((r) => r.data) });

  const inWarehouses = warehouses.filter((w: any) => 
    w.isActive && (w.type === 'FRIDGE' || w.type === 'SUPPLIES')
  );
  const allWarehouses = warehouses.filter((w: any) => w.isActive);

  const handleSave = async () => {
    if (!warehouseId) return setError('Оберіть склад');
    if (!productId) return setError('Оберіть продукт');
    if (!quantity || Number(quantity) <= 0) return setError('Вкажіть кількість');
    if (type === 'TRANSFER' && !toWarehouseId) return setError('Оберіть склад призначення');
    if (type === 'ADJUSTMENT' && !comment.trim()) return setError('Для ревізії потрібен коментар');
    setLoading(true);
    setError('');
    try {
      await api.post('/warehouses/movement', {
        type, warehouseId,
        ...(type === 'TRANSFER' && { toWarehouseId }),
        productId, quantity: Number(quantity),
        note: comment || undefined,
        form: type === 'IN' ? form : 'FORM_1',
        ...(type === 'IN' && pricePerKg && { pricePerKg: Number(pricePerKg) }),
        ...(type === 'IN' && supplierId && { supplierId }),
        ...(type === 'IN' && arrivedAt && { arrivedAt }),
      });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Помилка збереження');
    } finally {
      setLoading(false);
    }
  };

  const qtyNum = Number(quantity) || 0;
  const priceNum = Number(pricePerKg) || 0;
  const sumWithVat = qtyNum * priceNum;
  const sumNoVat = sumWithVat / (1 + VAT_RATE);
  const priceNoVat = priceNum / (1 + VAT_RATE);

  const typeConfig = {
    IN:         { icon: '↓', label: 'Надходження',  desc: 'Прийом на холодильник',      color: 'border-green-400 bg-green-50 text-green-700' },
    OUT:        { icon: '↑', label: 'Списання',      desc: 'Зіпсований або втрачений',   color: 'border-red-400 bg-red-50 text-red-700' },
    TRANSFER:   { icon: '↔', label: 'Переміщення',   desc: 'Між складами',               color: 'border-blue-400 bg-blue-50 text-blue-700' },
    ADJUSTMENT: { icon: '⚖', label: 'Ревізія',       desc: 'Коригування залишків',        color: 'border-orange-400 bg-orange-50 text-orange-700' },
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b shrink-0 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">Рух товару</h2>
            <p className="text-xs text-gray-400 mt-0.5">Оберіть тип операції і заповніть дані</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="px-6 pt-5 pb-4 border-b">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Тип операції</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(typeConfig) as [keyof typeof typeConfig, typeof typeConfig[keyof typeof typeConfig]][]).map(([t, cfg]) => (
                <button key={t} onClick={() => { setType(t as any); setWarehouseId(''); }}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${type === t ? cfg.color : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'}`}>
                  <div className="text-2xl mb-1">{cfg.icon}</div>
                  <div className="font-semibold text-xs">{cfg.label}</div>
                  <div className="text-xs opacity-60 mt-0.5 leading-tight">{cfg.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className={`grid gap-3 ${type === 'TRANSFER' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  {type === 'TRANSFER' ? 'Склад відправник' : 'Склад'}
                  {type === 'IN' && <span className="text-orange-400 ml-1 normal-case font-normal">· холодильники та матеріали</span>}
                </label>
                <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Оберіть склад...</option>
                  {(type === 'IN' ? inWarehouses : allWarehouses).map((w: any) => (
                    <option key={w.id} value={w.id}>{warehouseTypeIcon[w.type as WarehouseType]} {w.name}</option>
                  ))}
                </select>
              </div>
              {type === 'TRANSFER' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Склад отримувач</label>
                  <select value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Оберіть склад...</option>
                    {allWarehouses.filter((w: any) => w.id !== warehouseId).map((w: any) => (
                      <option key={w.id} value={w.id}>{warehouseTypeIcon[w.type as WarehouseType]} {w.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Продукт</label>
                <select value={productId} onChange={(e) => setProductId(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Оберіть продукт...</option>
                  {products.map((p: any) => <option key={p.id} value={p.id}>🐟 {p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Кількість</label>
                <div className="flex items-center gap-1.5">
                  <input type="number" step="0.001" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                    className="flex-1 min-w-0 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.000" />
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-2.5 rounded-xl border border-gray-200 shrink-0">кг</span>
                </div>
              </div>
            </div>

            {type === 'IN' && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-4">
                <div className="text-xs font-semibold text-green-700 uppercase tracking-wide">↓ Параметри надходження</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-green-600 font-medium mb-1.5">Форма оплати</label>
                    <div className="flex rounded-lg border border-green-200 overflow-hidden text-sm">
                      {(['FORM_1', 'FORM_2'] as FormType[]).map((f) => (
                        <button key={f} onClick={() => setForm(f)}
                          className={`flex-1 py-2 transition-colors text-xs ${form === f ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-green-50'}`}>
                          {f === 'FORM_1' ? '🏦 Ф1' : '💵 Ф2'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-green-600 font-medium mb-1.5">Постачальник</label>
                    <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
                      className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                      <option value="">Без постачальника</option>
                      {suppliers.filter((s: any) => s.isActive).map((s: any) => <option key={s.id} value={s.id}>🏭 {s.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-green-600 font-medium mb-1.5">Ціна з ПДВ (₴/кг)<span className="text-green-400 ml-1 font-normal">— необов'язково</span></label>
                  <div className="flex items-center gap-2">
                    <input type="number" step="0.01" min="0" value={pricePerKg} onChange={(e) => setPricePerKg(e.target.value)}
                      className="flex-1 border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" placeholder="0.00" />
                    <span className="text-xs text-green-500 bg-white px-3 py-2 rounded-lg border border-green-200 shrink-0">₴/кг</span>
                  </div>
                </div>
                {priceNum > 0 && qtyNum > 0 && (
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {[
                      { label: 'Ціна без ПДВ', value: `${priceNoVat.toFixed(2)} ₴/кг`, color: 'text-gray-700' },
                      { label: 'ПДВ 20%', value: `${(priceNum - priceNoVat).toFixed(2)} ₴/кг`, color: 'text-orange-500' },
                      { label: 'Сума без ПДВ', value: `${sumNoVat.toFixed(2)} ₴`, color: 'text-gray-700' },
                      { label: 'Сума з ПДВ', value: `${sumWithVat.toFixed(2)} ₴`, color: 'text-green-600' },
                    ].map((c) => (
                      <div key={c.label} className="bg-white rounded-lg p-2 text-center border border-green-100">
                        <div className="text-[10px] text-gray-400 mb-0.5">{c.label}</div>
                        <div className={`text-xs font-bold ${c.color}`}>{c.value}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <label className="block text-xs text-green-600 font-medium mb-1.5">Дата надходження<span className="text-green-400 ml-1 font-normal">— необов'язково, за замовч. сьогодні</span></label>
                  <input type="date" value={arrivedAt} onChange={(e) => setArrivedAt(e.target.value)}
                    className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Коментар{type === 'ADJUSTMENT' && <span className="text-red-400 ml-1 normal-case font-normal">* обов'язково</span>}
              </label>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder={type === 'ADJUSTMENT' ? 'Причина ревізії — обов\'язково...' : 'Необов\'язково...'} />
            </div>

            {error && (
              <div className="text-red-500 text-sm bg-red-50 px-4 py-3 rounded-xl border border-red-100 flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t flex gap-2 shrink-0 bg-gray-50">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-100 transition-colors">Скасувати</button>
          <button onClick={handleSave} disabled={loading}
            className="flex-2 min-w-[160px] bg-blue-600 text-white text-sm px-6 py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors font-semibold">
            {loading ? 'Збереження...' : `${typeConfig[type].icon} ${typeConfig[type].label}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReturnDetailsModal({ ret, onClose, onUpdated }: {
  ret: any;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState(ret.note || '');
  const [items, setItems] = useState(ret.items.map((i: any) => ({
    productId: i.product.id,
    totalQty: String(i.totalQty),
    goodQty: String(i.goodQty),
    warehouseId: i.warehouse.id,
  })));
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');

  const { data: products = [] } = useQuery({
    queryKey: ['products-active'],
    queryFn: () => api.get('/products/active').then(r => r.data),
  });
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then(r => r.data),
  });

  const fishProducts = (products as any[]).filter(p => p.category !== 'SUPPLY');
  const activeWarehouses = (warehouses as any[]).filter(w => w.isActive && w.type !== 'SUPPLIES');

  const getWasteQty = (item: any) => Math.max(0, (Number(item.totalQty) || 0) - (Number(item.goodQty) || 0));

  const updateItem = (idx: number, key: string, val: string) =>
    setItems((prev: any[]) => prev.map((r: any, i: number) => i === idx ? { ...r, [key]: val } : r));
  const addItem = () => setItems((prev: any[]) => [...prev, { productId: '', totalQty: '', goodQty: '', warehouseId: '' }]);
  const removeItem = (idx: number) => setItems((prev: any[]) => prev.filter((_: any, i: number) => i !== idx));

  const handleSave = async () => {
    if (items.some((i: any) => !i.productId || !i.totalQty || !i.goodQty || !i.warehouseId)) {
      return setError('Заповніть всі поля');
    }
    if (items.some((i: any) => Number(i.goodQty) > Number(i.totalQty))) {
      return setError('Добра кількість не може перевищувати загальну');
    }
    setLoading(true); setError('');
    try {
      await api.patch(`/client-returns/${ret.id}`, {
        note: note || undefined,
        items: items.map((i: any) => ({
          productId: i.productId,
          totalQty: Number(i.totalQty),
          goodQty: Number(i.goodQty),
          wasteQty: Number(i.totalQty) - Number(i.goodQty),
          warehouseId: i.warehouseId,
        })),
      });
      queryClient.invalidateQueries({ queryKey: ['client-returns'] });
      onUpdated();
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Помилка збереження');
    } finally { setLoading(false); }
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      await api.patch(`/client-returns/${ret.id}/resolve`);
      queryClient.invalidateQueries({ queryKey: ['client-returns'] });
      onUpdated();
      onClose();
    } catch {} finally { setResolving(false); }
  };

  const handleUnresolve = async () => {
    setResolving(true);
    try {
      await api.patch(`/client-returns/${ret.id}`, { resolvedAt: null });
      queryClient.invalidateQueries({ queryKey: ['client-returns'] });
      onUpdated();
      onClose();
    } catch {} finally { setResolving(false); }
  };

  const isResolved = !!ret.resolvedAt;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden">

        {/* Шапка */}
        <div className="px-6 py-4 border-b shrink-0 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl">↩</span>
              <h2 className="font-bold text-gray-800 text-lg">Повернення</h2>
              {isResolved
                ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">✓ Враховано</span>
                : <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-bold">⏳ Відкрито</span>
              }
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {ret.client?.name}
              {ret.deliveryPoint && <span> · 📍 {ret.deliveryPoint.name}</span>}
              <span> · {new Date(ret.createdAt).toLocaleDateString('uk-UA')}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Позиції */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Продукція</label>
              <button onClick={addItem} className="text-xs text-blue-600 hover:text-blue-700 font-semibold">+ Додати рядок</button>
            </div>

            <div className="grid grid-cols-12 gap-2 mb-2 px-1">
              <div className="col-span-3 text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Продукт</div>
              <div className="col-span-2 text-[10px] text-gray-400 font-semibold uppercase tracking-wide text-right">Всього кг</div>
              <div className="col-span-2 text-[10px] text-gray-400 font-semibold uppercase tracking-wide text-right">Добра кг</div>
              <div className="col-span-2 text-[10px] text-gray-400 font-semibold uppercase tracking-wide text-right">Утиль кг</div>
              <div className="col-span-2 text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Склад</div>
              <div className="col-span-1" />
            </div>

            <div className="space-y-2">
              {items.map((item: any, idx: number) => {
                const waste = getWasteQty(item);
                const isOverflow = Number(item.goodQty) > Number(item.totalQty);
                const goodPct = Number(item.totalQty) > 0
                  ? (Number(item.goodQty) / Number(item.totalQty)) * 100 : 0;

                return (
                  <div key={idx} className={`rounded-xl border p-3 transition-all ${isOverflow ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-3">
                        <select value={item.productId} onChange={e => updateItem(idx, 'productId', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                          <option value="">Оберіть...</option>
                          {fishProducts.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input type="number" step="0.001" min="0" value={item.totalQty}
                          onChange={e => updateItem(idx, 'totalQty', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                      </div>
                      <div className="col-span-2">
                        <input type="number" step="0.001" min="0" value={item.goodQty}
                          onChange={e => updateItem(idx, 'goodQty', e.target.value)}
                          className={`w-full border rounded-lg px-2 py-2 text-xs text-right focus:outline-none focus:ring-2 focus:ring-green-500 bg-white ${isOverflow ? 'border-red-300' : 'border-gray-300'}`} />
                      </div>
                      <div className="col-span-2 text-right">
                        <div className={`text-sm font-bold ${waste > 0 ? 'text-red-500' : 'text-gray-300'}`}>
                          {waste > 0 ? waste.toFixed(3) : '—'}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <select value={item.warehouseId} onChange={e => updateItem(idx, 'warehouseId', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                          <option value="">Склад...</option>
                          {activeWarehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {items.length > 1 && (
                          <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-lg">×</button>
                        )}
                      </div>
                    </div>
                    {Number(item.totalQty) > 0 && !isOverflow && (
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400">
                          <span>Придатність: <b className={goodPct >= 70 ? 'text-green-600' : goodPct >= 40 ? 'text-yellow-600' : 'text-red-500'}>{goodPct.toFixed(0)}%</b></span>
                          {waste > 0 && <span className="text-red-400">Утиль: {waste.toFixed(3)} кг</span>}
                        </div>
                        <div className="w-full bg-red-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full transition-all" style={{
                            width: `${Math.min(goodPct, 100)}%`,
                            background: goodPct >= 70 ? '#10b981' : goodPct >= 40 ? '#f59e0b' : '#ef4444',
                          }} />
                        </div>
                      </div>
                    )}
                    {isOverflow && <div className="mt-1 text-xs text-red-500 font-semibold">⚠️ Добра кількість перевищує загальну</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Примітка */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Коментар</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Причина повернення..." />
          </div>

          {error && (
            <div className="text-red-500 text-sm bg-red-50 border border-red-100 px-4 py-3 rounded-xl">⚠️ {error}</div>
          )}
        </div>

        {/* Кнопки */}
        <div className="px-6 py-4 border-t bg-gray-50 shrink-0 space-y-2">
          <div className="flex gap-2">
            {isResolved ? (
              <button onClick={handleUnresolve} disabled={resolving}
                className="flex-1 border border-orange-200 text-orange-600 text-sm px-4 py-2.5 rounded-xl hover:bg-orange-50 disabled:opacity-50 font-semibold">
                {resolving ? '...' : '↩ Відкрити знову'}
              </button>
            ) : (
              <button onClick={handleResolve} disabled={resolving}
                className="flex-1 bg-green-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50 font-semibold">
                {resolving ? '...' : '✓ Відмітити як враховане'}
              </button>
            )}
            <button onClick={handleSave} disabled={loading}
              className="flex-1 bg-blue-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-bold">
              {loading ? 'Зберігаю...' : '💾 Зберегти зміни'}
            </button>
          </div>
          <button onClick={onClose} className="w-full border border-gray-200 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-100">
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── WarehousePage ────────────────────────────────────────────────────────────
export default function WarehousePage() {
  const queryClient = useQueryClient();
  const [showMovement, setShowMovement] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showProduction, setShowProduction] = useState(false);
  const [productionItem, setProductionItem] = useState<{ warehouseId: string; stockItemId: string; quantity: string } | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stock' | 'movements' | 'returns' | 'incoming'>('stock');
  const [showReturn, setShowReturn] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedReturn, setSelectedReturn] = useState<any | null>(null);
  const [showWriteOffConfirm, setShowWriteOffConfirm] = useState(false);
  const [writeOffLoading, setWriteOffLoading] = useState(false);
  const { data: returns = [], isLoading: returnsLoading } = useQuery({
    queryKey: ['client-returns'],
    queryFn: () => api.get('/client-returns').then((r) => r.data),
    enabled: activeTab === 'returns',
  });

  const { data: stock = [], isLoading: stockLoading, refetch: refetchStock } = useQuery({
    queryKey: ['stock'],
    queryFn: () => api.get('/warehouses/stock/all').then((r) => r.data),
  });

  // Automatically picks up fresh data after EditStockItemModal saves
  const selectedWarehouse = useMemo(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => selectedWarehouseId ? (stock as any[]).find((w: any) => w.id === selectedWarehouseId) ?? null : null,
    [stock, selectedWarehouseId],
  );

  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then((r) => r.data),
  });
  const bypassStock = settings?.bypassStock === 'true';

  const toggleBypass = async () => {
    await api.put('/settings', { bypassStock: bypassStock ? 'false' : 'true' });
    refetchSettings();
  };

  const { data: movements = [], isLoading: movementsLoading } = useQuery({
    queryKey: ['movements'],
    queryFn: () => api.get('/warehouses/movements').then((r) => r.data),
    enabled: activeTab === 'movements',
  });

  const { data: incomingMovements = [], isLoading: incomingLoading } = useQuery({
    queryKey: ['incoming-movements'],
    queryFn: () => api.get('/warehouses/movements?type=IN').then((r) => r.data),
    enabled: activeTab === 'incoming',
  });

  const totalStats = stock.reduce(
    (acc: any, w: any) => {
      const kg = w.stockItems?.filter((i: any) => i.product.unit === 'кг').reduce((s: number, i: any) => s + Number(i.quantity), 0) || 0;
      const pcs = w.stockItems?.filter((i: any) => i.product.unit === 'шт').reduce((s: number, i: any) => s + Number(i.quantity), 0) || 0;
      const sum = w.stockItems?.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.pricePerKg ?? 0), 0) || 0;
      return { kg: acc.kg + kg, pcs: acc.pcs + pcs, sum: acc.sum + sum };
    },
    { kg: 0, pcs: 0, sum: 0 },
  );

  const warehouseTypeRing: Record<WarehouseType, string> = {
    RAW_MATERIAL: 'shadow-blue-200/60', IN_PRODUCTION: 'shadow-orange-200/60',
    FINISHED_GOODS: 'shadow-emerald-200/60', FRIDGE: 'shadow-cyan-200/60', SUPPLIES: 'shadow-amber-200/60',
  };

  return (
    <div className="space-y-5">
      {/* ── Шапка з дашбордом ── */}
      <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50/40 rounded-2xl sm:rounded-3xl border border-gray-100 p-3.5 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl shadow-md shadow-blue-200">
                🏭
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800 tracking-tight">Склади</h1>
                <p className="text-sm text-gray-400">Запаси, рухи та надходження продукції</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={toggleBypass}
              className={`text-sm sm:text-base px-3.5 py-2 rounded-xl transition-all font-medium flex items-center gap-1.5 border shadow-sm ${bypassStock ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:shadow'}`}>
              <span className={`w-2 h-2 rounded-full ${bypassStock ? 'bg-red-500' : 'bg-emerald-500'} ${!bypassStock && 'animate-pulse'}`} />
              {bypassStock ? 'Склад відключено' : 'Склад активний'}
            </button>
            <button onClick={() => setShowReturn(true)}
              className="bg-white border border-orange-200 text-orange-600 text-sm sm:text-base px-3.5 py-2 rounded-xl hover:bg-orange-50 transition-all font-medium flex items-center gap-1.5 shadow-sm hover:shadow">
              ↩ Повернення
            </button>
            <button onClick={() => setShowProduction(true)}
              className="bg-white border border-purple-200 text-purple-600 text-sm sm:text-base px-3.5 py-2 rounded-xl hover:bg-purple-50 transition-all font-medium flex items-center gap-1.5 shadow-sm hover:shadow">
              ⚙️ Виробництво
            </button>
            <button onClick={() => setShowWriteOffConfirm(true)}
              className="bg-white border border-red-200 text-red-600 text-sm sm:text-base px-3.5 py-2 rounded-xl hover:bg-red-50 transition-all font-medium flex items-center gap-1.5 shadow-sm hover:shadow">
              🗑 Списати сировину
            </button>
            <button onClick={() => setShowInvoice(true)}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm sm:text-base px-4 py-2 rounded-xl hover:opacity-90 transition-all font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-200">
              📄 Накладна постачальника
            </button>
            <button onClick={() => setShowMovement(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm sm:text-base px-4 py-2 rounded-xl hover:opacity-90 transition-all font-semibold flex items-center gap-1.5 shadow-md shadow-blue-200">
              + Рух товару
            </button>
          </div>
        </div>

        {/* Міні-статистика */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4 sm:mt-5">
          <div className="bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-gray-100 px-2.5 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-lg shrink-0">🏬</div>
            <div className="min-w-0">
              <div className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Складів</div>
              <div className="font-bold text-gray-800 text-xl leading-tight">{stock.length}</div>
            </div>
          </div>
          <div className="bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-gray-100 px-2.5 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 flex items-center justify-center text-lg shrink-0">⚖️</div>
            <div className="min-w-0">
              <div className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Обсяг</div>
              <div className="font-bold text-gray-800 text-xl leading-tight truncate">
                {totalStats.kg.toFixed(0)} кг{totalStats.pcs > 0 ? ` · ${Math.round(totalStats.pcs)} шт` : ''}
              </div>
            </div>
          </div>
          <div className="bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-gray-100 px-2.5 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-lg shrink-0">💰</div>
            <div className="min-w-0">
              <div className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Вартість</div>
              <div className="font-bold text-emerald-600 text-xl leading-tight">{totalStats.sum.toFixed(0)} ₴</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Таби ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[
          { value: 'stock', label: 'Залишки', icon: '📦' },
          { value: 'incoming', label: 'Надходження', icon: '📥' },
          { value: 'movements', label: 'Рухи', icon: '📋' },
          { value: 'returns', label: 'Повернення', icon: '↩' },
        ].map((tab) => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value as typeof activeTab)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm sm:text-base font-medium transition-all flex items-center gap-1.5 ${activeTab === tab.value ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
            <span>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'stock' && (
        stockLoading ? (
          <div className="text-center text-gray-400 py-16">
            <div className="inline-block w-6 h-6 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin mb-3" />
            <div className="text-base">Завантаження...</div>
          </div>
        ) : stock.length === 0 ? (
          <div className="text-center text-gray-400 py-16 border-2 border-dashed border-gray-200 rounded-2xl">
            <div className="text-4xl mb-3">📭</div>Немає даних про залишки
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stock.map((warehouse: any) => {
              const wType = warehouse.type as WarehouseType;
              const wTotalKg = warehouse.stockItems?.filter((i: any) => i.product.unit === 'кг').reduce((s: number, i: any) => s + Number(i.quantity), 0) || 0;
              const wTotalPcs = warehouse.stockItems?.filter((i: any) => i.product.unit === 'шт').reduce((s: number, i: any) => s + Number(i.quantity), 0) || 0;
              const totalSum = warehouse.stockItems?.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.pricePerKg ?? 0), 0) || 0;
              const items = warehouse.stockItems || [];
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const topItems = [...items].sort((a: any, b: any) => Number(b.quantity) - Number(a.quantity)).slice(0, 4);
              return (
                <div key={warehouse.id} onClick={() => setSelectedWarehouseId(warehouse.id)}
                  className={`bg-white rounded-3xl border border-gray-100 overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 group ${warehouseTypeRing[wType] || ''}`}>
                  {/* Шапка картки */}
                  <div className={`bg-gradient-to-br ${warehouseTypeColor[wType] || 'from-gray-400 to-gray-500'} p-5 relative overflow-hidden`}>
                    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
                    <div className="absolute -right-8 top-8 w-16 h-16 rounded-full bg-white/10" />
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl shadow-inner">
                          {warehouseTypeIcon[wType] || '🏭'}
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-lg leading-tight">{warehouse.name}</h3>
                          <span className="text-white/70 text-sm font-medium">{warehouseTypeLabel[wType]}</span>
                        </div>
                      </div>
                    </div>
                    <div className="relative flex items-end justify-between mt-4">
                      <div>
                        <div className="text-white font-bold text-2xl leading-none tracking-tight">
                          {wTotalKg > 0 && <span>{wTotalKg.toFixed(1)}<span className="text-lg font-medium text-white/70 ml-1">кг</span></span>}
                          {wTotalKg > 0 && wTotalPcs > 0 && <span className="text-white/40 mx-1.5">·</span>}
                          {wTotalPcs > 0 && <span>{Math.round(wTotalPcs)}<span className="text-lg font-medium text-white/70 ml-1">шт</span></span>}
                          {wTotalKg === 0 && wTotalPcs === 0 && <span className="text-white/50 text-lg">порожньо</span>}
                        </div>
                      </div>
                      {totalSum > 0 && (
                        <div className="bg-white/15 backdrop-blur-sm rounded-lg px-2.5 py-1">
                          <div className="text-white font-bold text-base">{totalSum.toFixed(0)} ₴</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Тіло картки */}
                  <div className="p-4">
                    {!items.length ? (
                      <div className="text-sm text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-xl">
                        <div className="text-2xl mb-1.5 opacity-40">📭</div>Порожньо
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2 mb-3">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {topItems.map((item: any) => {
                            const qty = Number(item.quantity);
                            return (
                              <div key={item.id} className="flex justify-between items-baseline gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-md font-bold ${item.form === 'FORM_1' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                    {item.form === 'FORM_1' ? 'Ф1' : 'Ф2'}
                                  </span>
                                  <span className="text-gray-600 text-sm truncate font-medium">{item.product.name}</span>
                                </div>
                                <span className="font-bold text-gray-800 text-sm shrink-0">
                                  {qty.toFixed(item.product.unit === 'шт' ? 0 : 3)}
                                  <span className="text-xs font-normal text-gray-400 ml-0.5">{item.product.unit}</span>
                                </span>
                              </div>
                            );
                          })}
                          {items.length > 4 && (
                            <div className="text-[11px] text-gray-400 text-center pt-1 font-medium">+{items.length - 4} позицій</div>
                          )}
                        </div>
                        <div className="flex items-center justify-center gap-1 text-sm font-semibold text-blue-500 group-hover:text-blue-600 group-hover:gap-2 transition-all pt-1 border-t border-gray-50">
                          Деталі <span className="transition-transform group-hover:translate-x-0.5">→</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {activeTab === 'incoming' && (
        incomingLoading ? (
          <div className="text-center text-gray-400 py-12">Завантаження...</div>
        ) : /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          (incomingMovements as any[]).filter((m: any) => m.warehouse?.type === 'FRIDGE').length === 0 ? (
          <div className="text-center text-gray-400 py-12 border-2 border-dashed border-gray-200 rounded-xl">
            <div className="text-4xl mb-3">📥</div>
            <div className="font-medium">Надходжень ще не було</div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Мобільний вид */}
            <div className="sm:hidden divide-y divide-gray-100">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(incomingMovements as any[]).filter((m: any) => m.warehouse?.type === 'FRIDGE').map((m: any) => {
                const price = Number(m.pricePerKg ?? 0);
                const qty = Math.abs(Number(m.quantity));
                return (
                  <div key={m.id} className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="font-medium text-gray-800 text-base">🐟 {m.product?.name || '—'}</div>
                      <span className="font-bold text-gray-800 shrink-0">{qty.toFixed(3)} {m.product?.unit || 'кг'}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-gray-400 mt-0.5">
                      <span>{m.warehouse?.name}</span>
                      {m.supplier?.name && <span className="text-purple-600">🏭 {m.supplier.name}</span>}
                      {price > 0 && <span className="text-green-600 font-medium">{price.toFixed(2)} ₴/кг · {(qty * price).toFixed(2)} ₴</span>}
                      <span className={`px-1.5 py-0.5 rounded font-medium ${m.form === 'FORM_1' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                        {m.form === 'FORM_1' ? 'Ф1' : 'Ф2'}
                      </span>
                    </div>
                    {m.note && <div className="mt-1 text-sm text-amber-600 bg-amber-50 rounded px-2 py-1">💬 {m.note}</div>}
                    <div className="text-sm text-gray-400 mt-1">{new Date(m.createdAt).toLocaleDateString('uk-UA')}</div>
                  </div>
                );
              })}
            </div>
            {/* Десктопний вид */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-base">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-sm text-gray-500">
                    <th className="px-4 py-3 font-semibold">Дата</th>
                    <th className="px-4 py-3 font-semibold">Продукт</th>
                    <th className="px-4 py-3 font-semibold">Склад</th>
                    <th className="px-4 py-3 font-semibold">Постачальник</th>
                    <th className="px-4 py-3 font-semibold text-right">Кількість</th>
                    <th className="px-4 py-3 font-semibold text-right">Ціна/кг (з ПДВ)</th>
                    <th className="px-4 py-3 font-semibold text-right">Сума</th>
                    <th className="px-4 py-3 font-semibold">Форма</th>
                    <th className="px-4 py-3 font-semibold">Коментар</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(incomingMovements as any[]).filter((m: any) => m.warehouse?.type === 'FRIDGE').map((m: any) => {
                    const price = Number(m.pricePerKg ?? 0);
                    const qty = Math.abs(Number(m.quantity));
                    return (
                      <tr key={m.id} className="hover:bg-green-50/30 transition-colors">
                        <td className="px-4 py-2.5 text-sm text-gray-400 whitespace-nowrap">{new Date(m.createdAt).toLocaleDateString('uk-UA')}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-800 text-sm">🐟 {m.product?.name || '—'}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-500">{m.warehouse?.name}</td>
                        <td className="px-4 py-2.5 text-sm">
                          {m.supplier?.name
                            ? <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded">{m.supplier.name}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-800 text-sm">{qty.toFixed(3)} {m.product?.unit || 'кг'}</td>
                        <td className="px-4 py-2.5 text-right text-sm">
                          {price > 0 ? <span className="font-medium text-gray-700">{price.toFixed(2)} ₴</span> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm">
                          {price > 0 ? <span className="font-semibold text-green-600">{(qty * price).toFixed(2)} ₴</span> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.form === 'FORM_1' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                            {m.form === 'FORM_1' ? 'Ф1' : 'Ф2'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm max-w-[160px]">
                          {m.note
                            ? <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{m.note}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {activeTab === 'movements' && (
        movementsLoading ? (
          <div className="text-center text-gray-400 py-12">Завантаження...</div>
        ) : movements.length === 0 ? (
          <div className="text-center text-gray-400 py-12 border-2 border-dashed border-gray-200 rounded-xl">Рухів ще не було</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Мобільний вид */}
            <div className="sm:hidden divide-y divide-gray-100">
              {movements.map((m: any) => (
                <div key={m.id} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${movementTypeColor[m.type as MovementType]}`}>
                        {movementTypeIcon[m.type as MovementType]} {movementTypeLabel[m.type as MovementType]}
                      </span>
                      {m.form && (
                        <span className={`text-sm px-1.5 py-0.5 rounded font-medium ${m.form === 'FORM_1' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                          {m.form === 'FORM_1' ? 'Ф1' : 'Ф2'}
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-gray-800 shrink-0">{Number(m.quantity).toFixed(3)}</span>
                  </div>
                  <div className="font-medium text-gray-700 text-base">🐟 {m.product?.name || '—'}</div>
                  <div className="text-sm text-gray-400 mt-0.5">
                    {m.warehouse?.name}{m.toWarehouse && ` → ${m.toWarehouse.name}`}
                    <span className="mx-1">·</span>{new Date(m.createdAt).toLocaleDateString('uk-UA')}
                  </div>
                  {m.note && <div className="text-sm text-gray-400 mt-0.5 italic">{m.note}</div>}
                </div>
              ))}
            </div>
            {/* Десктопний вид */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-base">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-sm text-gray-500">
                    <th className="px-4 py-3 font-medium">Тип</th>
                    <th className="px-4 py-3 font-medium">Продукт</th>
                    <th className="px-4 py-3 font-medium">Склад</th>
                    <th className="px-4 py-3 font-medium text-right">Кількість</th>
                    <th className="px-4 py-3 font-medium text-right">Форма</th>
                    <th className="px-4 py-3 font-medium text-right">Примітка</th>
                    <th className="px-4 py-3 font-medium text-right">Дата</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movements.map((m: any) => (
                    <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${movementTypeColor[m.type as MovementType]}`}>
                          {movementTypeIcon[m.type as MovementType]} {movementTypeLabel[m.type as MovementType]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-medium">🐟 {m.product?.name || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-sm">
                        <div>{m.warehouse?.name}</div>
                        {m.toWarehouse && <div className="text-gray-400">→ {m.toWarehouse.name}</div>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">{Number(m.quantity).toFixed(3)}</td>
                      <td className="px-4 py-3 text-right">
                        {m.form ? (
                          <span className={`text-sm px-2 py-0.5 rounded-full ${m.form === 'FORM_1' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                            {m.form === 'FORM_1' ? 'Ф1' : 'Ф2'}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400 text-sm max-w-[120px] truncate">{m.note || '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-400 text-sm">{new Date(m.createdAt).toLocaleDateString('uk-UA')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {activeTab === 'returns' && (
        returnsLoading ? (
          <div className="text-center text-gray-400 py-12">Завантаження...</div>
        ) : returns.length === 0 ? (
          <div className="text-center text-gray-400 py-12 border-2 border-dashed border-gray-200 rounded-xl">Повернень ще не було</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Мобільний вид */}
            <div className="sm:hidden divide-y divide-gray-100">
              {returns.map((ret: any) => {
                const retItems = ret.items as Array<{ totalQty: unknown; goodQty: unknown; wasteQty: unknown }>;
                const totalQty = retItems.reduce((s: number, i) => s + Number(i.totalQty), 0);
                const goodQty = retItems.reduce((s: number, i) => s + Number(i.goodQty), 0);
                const wasteQty = retItems.reduce((s: number, i) => s + Number(i.wasteQty), 0);
                return (
                  <div key={ret.id} className="p-4 active:bg-blue-50/50 cursor-pointer" onClick={() => setSelectedReturn(ret)}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <div className="font-semibold text-gray-800">{ret.client?.name}</div>
                        {ret.deliveryPoint && <div className="text-xs text-gray-400">📍 {ret.deliveryPoint.name}</div>}
                      </div>
                      {ret.resolvedAt
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium shrink-0">✓ Враховано</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium shrink-0">⏳ Відкрито</span>
                      }
                    </div>
                    <div className="flex items-center gap-3 text-xs mt-1.5">
                      <span className="text-gray-500">Всього: <span className="font-medium text-gray-700">{totalQty.toFixed(3)} кг</span></span>
                      <span className="text-gray-300">·</span>
                      <span className="text-gray-500">Добра: <span className="font-medium text-green-600">{goodQty.toFixed(3)} кг</span></span>
                      {wasteQty > 0 && <>
                        <span className="text-gray-300">·</span>
                        <span className="text-red-500 font-medium">{wasteQty.toFixed(3)} кг утиль</span>
                      </>}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{new Date(ret.createdAt).toLocaleDateString('uk-UA')}</div>
                  </div>
                );
              })}
            </div>
            {/* Десктопний вид */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-xs text-gray-500">
                    <th className="px-4 py-3 font-medium">Клієнт</th>
                    <th className="px-4 py-3 font-medium">Магазин</th>
                    <th className="px-4 py-3 font-medium">Продукція</th>
                    <th className="px-4 py-3 font-medium text-right">Всього</th>
                    <th className="px-4 py-3 font-medium text-right">Добра</th>
                    <th className="px-4 py-3 font-medium text-right">Утиль</th>
                    <th className="px-4 py-3 font-medium text-center">Статус</th>
                    <th className="px-4 py-3 font-medium text-right">Дата</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {returns.map((ret: any) => (
                    <tr key={ret.id} className="hover:bg-gray-50 transition-colors" onClick={() => setSelectedReturn(ret)}>
                      <td className="px-4 py-3 font-medium text-gray-800">{ret.client?.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {ret.deliveryPoint ? (
                          <span className="flex items-center gap-1">
                            <span>📍</span>{ret.deliveryPoint.name}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {ret.items.map((item: any) => (
                            <div key={item.id} className="text-xs text-gray-600">
                              🐟 {item.product.name}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 font-medium">
                        {ret.items.reduce((s: number, i: any) => s + Number(i.totalQty), 0).toFixed(3)} кг
                      </td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">
                        {ret.items.reduce((s: number, i: any) => s + Number(i.goodQty), 0).toFixed(3)} кг
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(() => {
                          const waste = ret.items.reduce((s: number, i: any) => s + Number(i.wasteQty), 0);
                          return waste > 0
                            ? <span className="text-red-500 font-medium">{waste.toFixed(3)} кг</span>
                            : <span className="text-gray-300">—</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {ret.resolvedAt ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">✓ Враховано</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">⏳ Відкрито</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400 text-xs">
                        {new Date(ret.createdAt).toLocaleDateString('uk-UA')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {selectedWarehouse && (
        <WarehouseModal warehouse={selectedWarehouse} onClose={() => setSelectedWarehouseId(null)}
          onMovement={() => { setSelectedWarehouseId(null); setShowMovement(true); }}
          onProduction={(item) => { setSelectedWarehouseId(null); setProductionItem(item); setShowProduction(true); }} />
      )}
      {showMovement && (
        <MovementModal onClose={() => { setShowMovement(false); refetchStock(); }} />
      )}
      {showInvoice && (
        <SupplierInvoiceModal onClose={() => { setShowInvoice(false); refetchStock(); }} />
      )}
      {showProduction && (
        <ProductionModal
          initialItem={productionItem ?? undefined}
          onClose={() => { setShowProduction(false); setProductionItem(null); refetchStock(); }} />
      )}
      {showReturn && (
        <ReturnModal onClose={() => { setShowReturn(false); refetchStock(); }} />
      )}

      {selectedReturn && (
        <ReturnDetailsModal
          ret={selectedReturn}
          onClose={() => setSelectedReturn(null)}
          onUpdated={() => queryClient.invalidateQueries({ queryKey: ['client-returns'] })}
        />
      )}

      {showWriteOffConfirm && (() => {
        type RawStockItem = { id: string; quantity: string; product: { name: string }; supplier: { name: string } | null };
        type RawWarehouse = { type: string; name: string; stockItems: RawStockItem[] };
        type RawItem = RawStockItem & { warehouseName: string };
        const rawItems: RawItem[] = (stock as RawWarehouse[])
          .flatMap(w => (w.stockItems ?? []).filter(i => Number(i.quantity) > 0).map(i => ({ ...i, warehouseName: w.name })));

        const handleWriteOff = async () => {
          setWriteOffLoading(true);
          try {
            await api.post('/warehouses/writeoff-all-raw', { note: 'Повне списання сировини' });
            setShowWriteOffConfirm(false);
            refetchStock();
          } finally {
            setWriteOffLoading(false);
          }
        };

        return (
          <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg">
              <div className="px-5 pt-5 pb-4 border-b flex items-start justify-between">
                <div>
                  <h2 className="font-bold text-gray-800 text-lg">🗑 Списати всю сировину</h2>
                  <p className="text-xs text-red-500 font-medium mt-0.5">Спишуться всі залишки з усіх активних складів</p>
                </div>
                <button onClick={() => setShowWriteOffConfirm(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-xl shrink-0">×</button>
              </div>

              <div className="px-5 py-3 max-h-72 overflow-y-auto">
                {rawItems.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-6">Сировини на складах немає</p>
                ) : (
                  <div className="space-y-1">
                    {rawItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div>
                          <span className="text-sm font-medium text-gray-800">{item.product.name}</span>
                          <span className="text-xs text-gray-400 ml-2">{item.warehouseName}</span>
                          {item.supplier && <span className="text-xs text-blue-500 ml-1">· {item.supplier.name}</span>}
                        </div>
                        <span className="text-sm font-bold text-red-500 shrink-0 ml-3">−{Number(item.quantity).toFixed(3)} кг</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-5 pb-6 pt-3 border-t flex gap-2">
                <button onClick={() => setShowWriteOffConfirm(false)}
                  className="flex-1 border border-gray-200 text-gray-600 text-sm py-3 rounded-xl hover:bg-gray-50 font-medium">
                  Скасувати
                </button>
                <button onClick={handleWriteOff} disabled={writeOffLoading || rawItems.length === 0}
                  className="flex-1 bg-red-600 text-white text-sm py-3 rounded-xl hover:bg-red-700 disabled:opacity-50 font-bold">
                  {writeOffLoading ? '...' : `Списати ${rawItems.length} позицій`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}