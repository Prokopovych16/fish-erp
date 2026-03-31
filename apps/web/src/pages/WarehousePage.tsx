import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
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


// ─── WarehouseModal ───────────────────────────────────────────────────────────
function WarehouseModal({ warehouse, onClose, onMovement }: {
  warehouse: any; onClose: () => void; onMovement: () => void;
}) {
  const [formFilter, setFormFilter] = useState<'ALL' | 'FORM_1' | 'FORM_2'>('ALL');
  const items = warehouse.stockItems || [];
  const filtered = (formFilter === 'ALL' ? items : items.filter((i: any) => i.form === formFilter))
    .filter((i: any) => Number(i.quantity) > 0);
  const totalSum = filtered.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.pricePerKg ?? 0), 0);
  const totalSumNoVat = totalSum / (1 + VAT_RATE);
  const totalQty = filtered.reduce((s: number, i: any) => s + Number(i.quantity), 0);
  const type = warehouse.type as WarehouseType;


  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className={`bg-gradient-to-r ${warehouseTypeColor[type] || 'from-gray-500 to-gray-600'} px-5 py-4 shrink-0`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{warehouseTypeIcon[type] || '🏭'}</span>
              <div>
                <h2 className="font-bold text-white text-lg">{warehouse.name}</h2>
                <span className="text-white/60 text-xs">{warehouseTypeLabel[type]}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-4 text-sm">
                {[
                  { label: 'Позицій', value: String(filtered.length) },
                  { label: 'Загально', value: `${totalQty.toFixed(1)} кг` },
                  { label: 'Сума з ПДВ', value: `${totalSum.toFixed(0)} ₴` },
                  { label: 'Без ПДВ', value: `${totalSumNoVat.toFixed(0)} ₴` },
                ].map((stat, i, arr) => (
                  <div key={stat.label} className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-white/60 text-xs">{stat.label}</div>
                      <div className="text-white font-bold">{stat.value}</div>
                    </div>
                    {i < arr.length - 1 && <div className="w-px h-8 bg-white/20" />}
                  </div>
                ))}
              </div>
              <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none ml-2">×</button>
            </div>
          </div>
        </div>

        <div className="px-5 py-2.5 border-b bg-gray-50 flex items-center justify-between shrink-0">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs bg-white">
            {[{ value: 'ALL', label: 'Всі' }, { value: 'FORM_1', label: '🏦 Ф1' }, { value: 'FORM_2', label: '💵 Ф2' }].map((f) => (
              <button key={f.value} onClick={() => setFormFilter(f.value as typeof formFilter)}
                className={`px-3 py-1.5 transition-colors ${formFilter === f.value ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400">{filtered.length} позицій</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-center text-gray-400 py-16"><div className="text-4xl mb-3">📭</div><div className="font-medium">Склад порожній</div></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-4 py-3 font-semibold">Продукт</th>
                  <th className="px-4 py-3 font-semibold">Форма</th>
                  <th className="px-4 py-3 font-semibold">Постачальник</th>
                  <th className="px-4 py-3 font-semibold">Дата</th>
                  <th className="px-4 py-3 font-semibold text-right">Кількість</th>
                  <th className="px-4 py-3 font-semibold text-right">Ціна/кг (з ПДВ)</th>
                  <th className="px-4 py-3 font-semibold text-right">Без ПДВ</th>
                  <th className="px-4 py-3 font-semibold text-right">Сума з ПДВ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(
                  filtered.reduce((acc: Record<string, any[]>, item: any) => {
                    const key = item.product.name;
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(item);
                    return acc;
                  }, {})
                ).map(([productName, stockItems]) => {
                  const productQty = stockItems.reduce((s: number, i: any) => s + Number(i.quantity), 0);
                  const productSum = stockItems.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.pricePerKg ?? 0), 0);
                  return (
                    <>
                      {stockItems.map((item: any, idx: number) => {
                        const qty = Number(item.quantity);
                        const price = Number(item.pricePerKg ?? 0);
                        const priceNoVat = price / (1 + VAT_RATE);
                        const sumWithVat = qty * price;
                        return (
                          <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                            <td className="px-4 py-3">
                              {idx === 0 ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-base">🐟</span>
                                  <div>
                                    <div className="font-semibold text-gray-800">{productName}</div>
                                    {stockItems.length > 1 && <div className="text-xs text-gray-400">{stockItems.length} партії · {productQty.toFixed(3)} кг</div>}
                                  </div>
                                </div>
                              ) : (
                                <div className="pl-7 text-xs text-gray-400">↳ партія {idx + 1}</div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.form === 'FORM_1' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                {item.form === 'FORM_1' ? 'Ф1' : 'Ф2'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {item.supplier?.name ? <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded">{item.supplier.name}</span> : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400">{new Date(item.arrivedAt).toLocaleDateString('uk-UA')}</td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-bold text-gray-800 text-base">{qty.toFixed(3)}</span>
                              <span className="text-xs text-gray-400 ml-1">{item.product.unit}</span>
                            </td>
                            <td className="px-4 py-3 text-right">{price > 0 ? <span className="font-medium text-gray-700">{price.toFixed(2)} ₴</span> : <span className="text-xs text-gray-300">—</span>}</td>
                            <td className="px-4 py-3 text-right">{price > 0 ? <span className="text-gray-500 text-xs">{priceNoVat.toFixed(2)} ₴</span> : <span className="text-xs text-gray-300">—</span>}</td>
                            <td className="px-4 py-3 text-right">{sumWithVat > 0 ? <span className="font-semibold text-green-600">{sumWithVat.toFixed(2)} ₴</span> : <span className="text-xs text-gray-300">—</span>}</td>
                          </tr>
                        );
                      })}
                      {stockItems.length > 1 && (
                        <tr className="bg-blue-50/50 border-t border-blue-100">
                          <td className="px-4 py-2" colSpan={4}><span className="text-xs font-semibold text-blue-600">Разом: {productName}</span></td>
                          <td className="px-4 py-2 text-right"><span className="font-bold text-blue-700">{productQty.toFixed(3)} кг</span></td>
                          <td className="px-4 py-2" colSpan={2} />
                          <td className="px-4 py-2 text-right">{productSum > 0 && <span className="font-bold text-green-600">{productSum.toFixed(2)} ₴</span>}</td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-gray-300 bg-gray-50 sticky bottom-0">
                
              </tfoot>
            </table>
          )}
        </div>

        <div className="border-t bg-gray-50 px-5 py-3 shrink-0 flex gap-2">
          <button onClick={onMovement} className="flex-1 bg-blue-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-colors font-medium">+ Рух товару</button>
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-100 transition-colors">Закрити</button>
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
  const [showProduction, setShowProduction] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'stock' | 'movements' | 'returns'>('stock');
  const [showReturn, setShowReturn] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<any | null>(null);
  const { data: returns = [], isLoading: returnsLoading } = useQuery({
    queryKey: ['client-returns'],
    queryFn: () => api.get('/client-returns').then((r) => r.data),
    enabled: activeTab === 'returns',
  });


  const { data: stock = [], isLoading: stockLoading, refetch: refetchStock } = useQuery({
    queryKey: ['stock'],
    queryFn: () => api.get('/warehouses/stock/all').then((r) => r.data),
  });

  const { data: movements = [], isLoading: movementsLoading } = useQuery({
    queryKey: ['movements'],
    queryFn: () => api.get('/warehouses/movements').then((r) => r.data),
    enabled: activeTab === 'movements',
  });

  const totalStats = stock.reduce(
    (acc: any, w: any) => {
      const qty = w.stockItems?.reduce((s: number, i: any) => s + Number(i.quantity), 0) || 0;
      const sum = w.stockItems?.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.pricePerKg ?? 0), 0) || 0;
      return { qty: acc.qty + qty, sum: acc.sum + sum };
    },
    { qty: 0, sum: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Склади</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {stock.length} складів · {totalStats.qty.toFixed(1)} кг · {totalStats.sum.toFixed(0)} ₴
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowReturn(true)}
            className="bg-orange-500 text-white text-sm px-4 py-2 rounded-xl hover:bg-orange-600 transition-colors font-medium flex items-center gap-2">
            ↩ Повернення
          </button>
          {/* Кнопка виробництва — фіолетова */}
          <button onClick={() => setShowProduction(true)}
            className="bg-purple-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-purple-700 transition-colors font-medium flex items-center gap-2">
            ⚙️ Виробництво
          </button>
          <button onClick={() => setShowMovement(true)}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors font-medium flex items-center gap-2">
            + Рух товару
          </button>
        </div>
      </div>

      <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm w-fit bg-white">
        {[
          { value: 'stock', label: '📦 Залишки' },
          { value: 'movements', label: '📋 Історія рухів' },
          { value: 'returns', label: '↩ Повернення' },
        ].map((tab) => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value as typeof activeTab)}
            className={`px-4 py-2 transition-colors ${activeTab === tab.value ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'stock' && (
        stockLoading ? (
          <div className="text-center text-gray-400 py-12">Завантаження...</div>
        ) : stock.length === 0 ? (
          <div className="text-center text-gray-400 py-12 border-2 border-dashed border-gray-200 rounded-xl">Немає даних про залишки</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {stock.map((warehouse: any) => {
              const wType = warehouse.type as WarehouseType;
              const totalQty = warehouse.stockItems?.reduce((s: number, i: any) => s + Number(i.quantity), 0) || 0;
              const totalSum = warehouse.stockItems?.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.pricePerKg ?? 0), 0) || 0;
              return (
                <div key={warehouse.id} onClick={() => setSelectedWarehouse(warehouse)}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-lg hover:border-blue-200 transition-all group">
                  <div className={`bg-gradient-to-r ${warehouseTypeColor[wType] || 'from-gray-400 to-gray-500'} p-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{warehouseTypeIcon[wType] || '🏭'}</span>
                        <div>
                          <h3 className="font-bold text-white">{warehouse.name}</h3>
                          <span className="text-white/60 text-xs">{warehouseTypeLabel[wType]}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-bold text-lg">{totalQty.toFixed(1)} кг</div>
                        {totalSum > 0 && <div className="text-white/70 text-xs">{totalSum.toFixed(0)} ₴</div>}
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    {!warehouse.stockItems?.length ? (
                      <div className="text-xs text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">Порожньо</div>
                    ) : (
                      <>
                        <div className="space-y-2 mb-3">
                          {warehouse.stockItems.slice(0, 4).map((item: any) => (
                            <div key={item.id} className="flex justify-between items-center text-sm">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${item.form === 'FORM_1' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                  {item.form === 'FORM_1' ? 'Ф1' : 'Ф2'}
                                </span>
                                <span className="text-gray-600 truncate">{item.product.name}</span>
                              </div>
                              <span className="font-semibold text-gray-800 shrink-0 ml-2">
                                {Number(item.quantity).toFixed(3)}
                                <span className="text-xs font-normal text-gray-400 ml-0.5">{item.product.unit}</span>
                              </span>
                            </div>
                          ))}
                          {warehouse.stockItems.length > 4 && (
                            <div className="text-xs text-gray-400 text-center py-1">+{warehouse.stockItems.length - 4} позицій...</div>
                          )}
                        </div>
                        <div className="text-xs text-blue-400 text-center group-hover:text-blue-500 transition-colors">Натисни для деталей →</div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-xs text-gray-500">
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
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${movementTypeColor[m.type as MovementType]}`}>
                          {movementTypeIcon[m.type as MovementType]} {movementTypeLabel[m.type as MovementType]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-medium">🐟 {m.product?.name || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        <div>{m.warehouse?.name}</div>
                        {m.toWarehouse && <div className="text-gray-400">→ {m.toWarehouse.name}</div>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">{Number(m.quantity).toFixed(3)}</td>
                      <td className="px-4 py-3 text-right">
                        {m.form ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${m.form === 'FORM_1' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                            {m.form === 'FORM_1' ? 'Ф1' : 'Ф2'}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400 text-xs max-w-[120px] truncate">{m.note || '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-400 text-xs">{new Date(m.createdAt).toLocaleDateString('uk-UA')}</td>
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
            <div className="overflow-x-auto">
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
        <WarehouseModal warehouse={selectedWarehouse} onClose={() => setSelectedWarehouse(null)}
          onMovement={() => { setSelectedWarehouse(null); setShowMovement(true); }} />
      )}
      {showMovement && (
        <MovementModal onClose={() => { setShowMovement(false); refetchStock(); }} />
      )}
      {showProduction && (
        <ProductionModal onClose={() => { setShowProduction(false); refetchStock(); }} />
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
    </div>
  );
}