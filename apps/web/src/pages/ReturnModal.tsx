// apps/web/src/pages/ReturnModal.tsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';

type WarehouseType = 'RAW_MATERIAL' | 'IN_PRODUCTION' | 'FINISHED_GOODS' | 'FRIDGE' | 'SUPPLIES';
const warehouseTypeIcon: Record<WarehouseType, string> = {
  RAW_MATERIAL: '🐟', IN_PRODUCTION: '⚙️', FINISHED_GOODS: '📦',
  FRIDGE: '❄️', SUPPLIES: '🧴',
};

export function ReturnModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState('');
  const [deliveryPointId, setDeliveryPointId] = useState(''); // ← НОВЕ
  const [note, setNote] = useState('');
  const [items, setItems] = useState([
    { productId: '', totalQty: '', goodQty: '', warehouseId: '' },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients').then(r => r.data),
  });
  const { data: products = [] } = useQuery({
    queryKey: ['products-active'],
    queryFn: () => api.get('/products/active').then(r => r.data),
  });
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then(r => r.data),
  });

  // ← НОВЕ: точки доставки для обраного клієнта
  const { data: deliveryPoints = [] } = useQuery({
    queryKey: ['delivery-points', clientId],
    queryFn: () => api.get(`/clients/${clientId}/delivery-points`).then(r => r.data),
    enabled: !!clientId,
  });

  const activeClients = (clients as any[]).filter(c => c.isActive);
  const fishProducts = (products as any[]).filter(p => p.category !== 'SUPPLY');
  const activeWarehouses = (warehouses as any[]).filter(w => w.isActive && w.type !== 'SUPPLIES');
  const activeDeliveryPoints = (deliveryPoints as any[]).filter((dp: any) => dp.isActive); // ← НОВЕ

  // ← При зміні клієнта скидаємо точку
  const handleClientChange = (id: string) => {
    setClientId(id);
    setDeliveryPointId('');
  };

  const addItem = () => setItems(prev => [...prev, { productId: '', totalQty: '', goodQty: '', warehouseId: '' }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, key: string, val: string) =>
    setItems(prev => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));

  const getWasteQty = (item: typeof items[0]) => {
    const total = Number(item.totalQty) || 0;
    const good = Number(item.goodQty) || 0;
    return Math.max(0, total - good);
  };

  const totalReceived = items.reduce((s, i) => s + (Number(i.totalQty) || 0), 0);
  const totalGood = items.reduce((s, i) => s + (Number(i.goodQty) || 0), 0);
  const totalWaste = items.reduce((s, i) => s + getWasteQty(i), 0);

  const handleSave = async () => {
    if (!clientId) return setError('Оберіть клієнта');
    if (!deliveryPointId) return setError('Оберіть магазин (точку доставки)'); // ← НОВЕ
    if (items.some(i => !i.productId || !i.totalQty || !i.goodQty || !i.warehouseId)) {
      return setError('Заповніть всі поля у кожному рядку');
    }
    if (items.some(i => Number(i.goodQty) > Number(i.totalQty))) {
      return setError('Кількість "добра" не може перевищувати загальну кількість');
    }
    setLoading(true); setError('');
    try {
      await api.post('/client-returns', {
        clientId,
        deliveryPointId, // ← НОВЕ
        note: note || undefined,
        items: items.map(i => ({
          productId: i.productId,
          totalQty: Number(i.totalQty),
          goodQty: Number(i.goodQty),
          warehouseId: i.warehouseId,
        })),
      });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['client-returns'] });
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Помилка збереження');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden">

        {/* Шапка */}
        <div className="px-6 py-4 border-b shrink-0 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">↩</span>
              <h2 className="font-bold text-gray-800 text-lg">Повернення від клієнта</h2>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Вкажіть що повернули і скільки придатного</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* ← НОВЕ: Клієнт + Магазин в один ряд */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Клієнт *
              </label>
              <select
                value={clientId}
                onChange={e => handleClientChange(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Оберіть клієнта...</option>
                {activeClients.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Магазин *
              </label>
              <select
                value={deliveryPointId}
                onChange={e => setDeliveryPointId(e.target.value)}
                disabled={!clientId}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">
                  {!clientId ? 'Спочатку оберіть клієнта' : 'Оберіть магазин...'}
                </option>
                {activeDeliveryPoints.map((dp: any) => (
                  <option key={dp.id} value={dp.id}>
                    📍 {dp.name}{dp.address ? ` — ${dp.address}` : ''}
                  </option>
                ))}
              </select>
              {clientId && activeDeliveryPoints.length === 0 && (
                <p className="text-xs text-orange-500 mt-1">
                  ⚠️ У клієнта немає активних точок доставки
                </p>
              )}
            </div>
          </div>

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
              {items.map((item, idx) => {
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
                          placeholder="0.000"
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                      </div>
                      <div className="col-span-2">
                        <input type="number" step="0.001" min="0" value={item.goodQty}
                          onChange={e => updateItem(idx, 'goodQty', e.target.value)}
                          placeholder="0.000"
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
                          {activeWarehouses.map((w: any) => (
                            <option key={w.id} value={w.id}>{warehouseTypeIcon[w.type as WarehouseType]} {w.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {items.length > 1 && (
                          <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-lg">×</button>
                        )}
                      </div>
                    </div>

                    {Number(item.totalQty) > 0 && Number(item.goodQty) >= 0 && !isOverflow && (
                      <div className="mt-2.5 space-y-1">
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
                    {isOverflow && (
                      <div className="mt-1.5 text-xs text-red-500 font-semibold">⚠️ Добра кількість перевищує загальну</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Коментар */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Коментар</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Причина повернення, стан продукції..." />
          </div>

          {error && (
            <div className="text-red-500 text-sm bg-red-50 border border-red-100 px-4 py-3 rounded-xl flex items-center gap-2">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Підсумок і кнопки */}
        <div className="px-6 py-4 border-t bg-gray-50 shrink-0 space-y-3">
          {totalReceived > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Отримано', value: `${totalReceived.toFixed(3)} кг`, color: 'text-gray-700' },
                { label: '↩ В холодильник', value: `${totalGood.toFixed(3)} кг`, color: 'text-green-600' },
                { label: '🗑 Утиль', value: `${totalWaste.toFixed(3)} кг`, color: totalWaste > 0 ? 'text-red-500' : 'text-gray-400' },
              ].map(c => (
                <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{c.label}</div>
                  <div className={`text-sm font-bold ${c.color}`}>{c.value}</div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-100">Скасувати</button>
            <button onClick={handleSave} disabled={loading}
              className="flex-1 bg-orange-500 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-orange-600 disabled:opacity-50 font-bold">
              {loading ? 'Зберігаю...' : '↩ Провести повернення'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}