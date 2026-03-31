// ─── Замінити ProductionModal в WarehousePage.tsx ────────────────────────────
// Видали форму з рядків сировини (береться з складу автоматично)
// Видали ціну з рядків готової продукції (рахується як собівартість)
// Додай чекбокс "Записати в калькулятор"

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';

type FormType = 'FORM_1' | 'FORM_2';
type WarehouseType = 'RAW_MATERIAL' | 'IN_PRODUCTION' | 'FINISHED_GOODS' | 'FRIDGE' | 'SUPPLIES';


const warehouseTypeIcon: Record<WarehouseType, string> = {
  RAW_MATERIAL: '🐟', IN_PRODUCTION: '⚙️', FINISHED_GOODS: '📦', FRIDGE: '❄️', SUPPLIES: '🧴',
};

export function ProductionModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();

  const [inputs, setInputs] = useState([
    { warehouseId: '', productId: '', quantity: '' },
  ]);
  const [outputs, setOutputs] = useState([
    { productId: '', quantity: '' },
  ]);
  const [note, setNote] = useState('');
  const [saveToCalc, setSaveToCalc] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: stock = [] } = useQuery({
    queryKey: ['stock'],
    queryFn: () => api.get('/warehouses/stock/all').then((r) => r.data),
  });
  const { data: products = [] } = useQuery({
    queryKey: ['products-active'],
    queryFn: () => api.get('/products/active').then((r) => r.data),
  });

  const activeWarehouses = stock.filter((w: any) => w.isActive);

  // Отримуємо партії для продукту на складі (для автоматичної форми і ціни)
  const getStockInfo = (warehouseId: string, productId: string) => {
    if (!warehouseId || !productId) return null;
    const wh = activeWarehouses.find((w: any) => w.id === warehouseId);
    if (!wh) return null;
    const items = (wh.stockItems || []).filter(
      (i: any) => i.productId === productId && Number(i.quantity) > 0
    );
    if (!items.length) return null;
    const totalQty = items.reduce((s: number, i: any) => s + Number(i.quantity), 0);
    // Середньозважена ціна
    const avgPrice = items.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.pricePerKg ?? 0), 0) / totalQty;
    // Перша форма (FIFO)
    const form = items[0].form as FormType;
    return { totalQty, avgPrice, form };
  };

  // Рядки сировини
  const addInput = () => setInputs(prev => [...prev, { warehouseId: '', productId: '', quantity: '' }]);
  const removeInput = (idx: number) => setInputs(prev => prev.filter((_, i) => i !== idx));
  const updateInput = (idx: number, key: string, val: string) =>
    setInputs(prev => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));

  // Рядки готової продукції
  const addOutput = () => setOutputs(prev => [...prev, { productId: '', quantity: '' }]);
  const removeOutput = (idx: number) => setOutputs(prev => prev.filter((_, i) => i !== idx));
  const updateOutput = (idx: number, key: string, val: string) =>
    setOutputs(prev => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));

  // Підсумки
  const totalInputCost = inputs.reduce((s, r) => {
    const info = getStockInfo(r.warehouseId, r.productId);
    return s + (Number(r.quantity) || 0) * (info?.avgPrice || 0);
  }, 0);
  const totalInputQty = inputs.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const totalOutputQty = outputs.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const costPerKg = totalOutputQty > 0 ? totalInputCost / totalOutputQty : 0;
  const yieldPct = totalInputQty > 0 ? (totalOutputQty / totalInputQty) * 100 : 0;

  const handleSave = async () => {
    if (inputs.some(r => !r.warehouseId || !r.productId || !r.quantity)) return setError('Заповніть всі рядки сировини');
    if (outputs.some(r => !r.productId || !r.quantity)) return setError('Заповніть всі рядки готової продукції');
    setLoading(true);
    setError('');
    try {
      // 1. Проводимо виробництво на складі
      await api.post('/warehouses/production', {
        inputs: inputs.map(r => {
          const info = getStockInfo(r.warehouseId, r.productId);
          return {
            warehouseId: r.warehouseId,
            productId: r.productId,
            quantity: Number(r.quantity),
            form: info?.form ?? 'FORM_1',
          };
        }),
        outputs: outputs.map(r => {
          const prod = (products as any[]).find((p: any) => p.id === r.productId);
          return {
            productId: r.productId,
            quantity: Number(r.quantity),
            form: 'FORM_1', // готова продукція завжди Ф1 за замовчуванням
            pricePerKg: costPerKg, // собівартість як ціна партії
          };
        }),
        note: note || undefined,
      });

      // 2. Якщо треба — зберігаємо в калькулятор
      if (saveToCalc) {
        await api.post('/production-calc', {
          note: note || undefined,
          inputs: inputs.map(r => {
            const info = getStockInfo(r.warehouseId, r.productId);
            const wh = activeWarehouses.find((w: any) => w.id === r.warehouseId);
            const stockItem = (wh?.stockItems || []).find(
              (i: any) => i.productId === r.productId && Number(i.quantity) > 0
            );
            const prod = (products as any[]).find((p: any) => p.id === r.productId);
            return {
              productName: prod?.name ?? r.productId,
              quantity: Number(r.quantity),
              pricePerKg: info?.avgPrice ?? 0,
              form: info?.form ?? 'FORM_1',
              supplierName: stockItem?.supplier?.name ?? null,
            };
          }),
          outputs: outputs.map(r => {
            const prod = (products as any[]).find((p: any) => p.id === r.productId);
            return {
              productName: prod?.name ?? r.productId,
              quantity: Number(r.quantity),
              form: 'FORM_1',
            };
          }),
        });
      }

      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['production-calc'] });
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Помилка збереження');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b shrink-0 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">⚙️</span>
              <h2 className="font-bold text-gray-800 text-lg">Виробництво</h2>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Спишіть сировину і вкажіть готову продукцію</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">

          {/* ── ВХІД: Сировина ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">↑</div>
                <span className="text-sm font-bold text-gray-700">Сировина (списання)</span>
                {totalInputQty > 0 && <span className="text-xs text-gray-400">{totalInputQty.toFixed(3)} кг · {totalInputCost.toFixed(2)} ₴</span>}
              </div>
              <button onClick={addInput} className="text-xs text-blue-600 hover:text-blue-700 font-semibold">+ Додати рядок</button>
            </div>
            <div className="space-y-2">
              {inputs.map((row, idx) => {
                const info = getStockInfo(row.warehouseId, row.productId);
                const qty = Number(row.quantity) || 0;
                const isOver = info && qty > info.totalQty;
                const lineCost = qty * (info?.avgPrice || 0);

                return (
                  <div key={idx} className={`rounded-xl border p-3 transition-all ${isOver ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="grid grid-cols-12 gap-2 items-end">
                      {/* Склад */}
                      <div className="col-span-4">
                        <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Склад</div>
                        <select value={row.warehouseId} onChange={(e) => updateInput(idx, 'warehouseId', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                          <option value="">Оберіть...</option>
                          {activeWarehouses.map((w: any) => (
                            <option key={w.id} value={w.id}>{warehouseTypeIcon[w.type as WarehouseType]} {w.name}</option>
                          ))}
                        </select>
                      </div>
                      {/* Продукт */}
                      <div className="col-span-5">
                        <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Продукт</div>
                        <select value={row.productId} onChange={(e) => updateInput(idx, 'productId', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                          <option value="">Оберіть...</option>
                          {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      {/* Кількість */}
                      <div className="col-span-2">
                        <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">кг</div>
                        <input type="number" step="0.001" min="0" value={row.quantity}
                          onChange={(e) => updateInput(idx, 'quantity', e.target.value)}
                          placeholder="0.000"
                          className={`w-full border rounded-lg px-2 py-2 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${isOver ? 'border-red-300' : 'border-gray-300'}`} />
                      </div>
                      {/* Видалити */}
                      <div className="col-span-1 flex justify-center">
                        {inputs.length > 1 && (
                          <button onClick={() => removeInput(idx)} className="text-red-400 hover:text-red-600 text-lg">×</button>
                        )}
                      </div>
                    </div>

                    {/* Інфо партії */}
                    {info && (
                      <div className="mt-2 flex flex-wrap gap-3 text-xs">
                        <span className={`${info.form === 'FORM_1' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'} px-2 py-0.5 rounded-full font-semibold`}>
                          {info.form === 'FORM_1' ? 'Ф1' : 'Ф2'} · автоматично
                        </span>
                        <span className="text-gray-500">Є: <b>{info.totalQty.toFixed(3)} кг</b></span>
                        {info.avgPrice > 0 && <span className="text-gray-500">Ціна: <b>{info.avgPrice.toFixed(2)} ₴/кг</b></span>}
                        {lineCost > 0 && <span className="text-green-600 font-semibold">= {lineCost.toFixed(2)} ₴</span>}
                        {isOver && <span className="text-red-500 font-semibold">⚠️ не вистачає {(qty - info.totalQty).toFixed(3)} кг</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Стрілка + собівартість */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-dashed border-gray-300" />
            <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-2 text-center">
              <div className="flex items-center gap-2">
                <span className="text-purple-600 text-sm">⚙️</span>
                <span className="text-xs font-semibold text-purple-700">Виробництво</span>
              </div>
              {totalInputCost > 0 && totalOutputQty > 0 && (
                <div className="mt-1 space-y-0.5">
                  <div className="text-xs text-purple-600">
                    Вхід: <b>{totalInputCost.toFixed(2)} ₴</b>
                  </div>
                  <div className="text-xs text-purple-600">
                    Собівартість: <b>{costPerKg.toFixed(4)} ₴/кг</b>
                  </div>
                  <div className={`text-xs font-bold ${yieldPct >= 80 ? 'text-green-600' : yieldPct >= 60 ? 'text-orange-500' : 'text-red-500'}`}>
                    Вихід: {yieldPct.toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 border-t border-dashed border-gray-300" />
          </div>

          {/* ── ВИХІД: Готова продукція ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold">↓</div>
                <span className="text-sm font-bold text-gray-700">Готова продукція → FINISHED_GOODS</span>
                {totalOutputQty > 0 && <span className="text-xs text-gray-400">{totalOutputQty.toFixed(3)} кг</span>}
              </div>
              <button onClick={addOutput} className="text-xs text-blue-600 hover:text-blue-700 font-semibold">+ Додати рядок</button>
            </div>
            <div className="space-y-2">
              {outputs.map((row, idx) => {
                const qty = Number(row.quantity) || 0;
                const lineCost = qty * costPerKg;
                // Частка цього виходу від загального
                const share = totalOutputQty > 0 ? (qty / totalOutputQty) * 100 : 0;

                return (
                  <div key={idx} className="rounded-xl border border-gray-200 bg-green-50/30 p-3">
                    <div className="grid grid-cols-12 gap-2 items-end">
                      {/* Продукт */}
                      <div className="col-span-7">
                        <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Готовий продукт</div>
                        <select value={row.productId} onChange={(e) => updateOutput(idx, 'productId', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                          <option value="">Оберіть...</option>
                          {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      {/* Фактична вага */}
                      <div className="col-span-4">
                        <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Факт. вага кг</div>
                        <input type="number" step="0.001" min="0" value={row.quantity}
                          onChange={(e) => updateOutput(idx, 'quantity', e.target.value)}
                          placeholder="0.000"
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs text-right focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
                      </div>
                      {/* Видалити */}
                      <div className="col-span-1 flex justify-center">
                        {outputs.length > 1 && (
                          <button onClick={() => removeOutput(idx)} className="text-red-400 hover:text-red-600 text-lg">×</button>
                        )}
                      </div>
                    </div>

                    {/* Собівартість цього рядка */}
                    {costPerKg > 0 && qty > 0 && (
                      <div className="mt-2 flex flex-wrap gap-3 text-xs">
                        <span className="text-gray-500">Собівартість: <b className="text-gray-700">{costPerKg.toFixed(4)} ₴/кг</b></span>
                        <span className="text-gray-500">Вартість партії: <b className="text-purple-600">{lineCost.toFixed(2)} ₴</b></span>
                        {totalOutputQty > 0 && outputs.length > 1 && (
                          <span className="text-gray-400">частка: {share.toFixed(1)}%</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Коментар */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Коментар</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Необов'язково..." />
          </div>

          {/* Чекбокс — записати в калькулятор */}
          <div
            onClick={() => setSaveToCalc(!saveToCalc)}
            className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all select-none ${
              saveToCalc
                ? 'border-purple-400 bg-purple-50'
                : 'border-gray-200 bg-gray-50 hover:border-gray-300'
            }`}
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
              saveToCalc ? 'bg-purple-600 border-purple-600' : 'border-gray-300 bg-white'
            }`}>
              {saveToCalc && <span className="text-white text-xs font-bold">✓</span>}
            </div>
            <div>
              <div className={`text-sm font-semibold ${saveToCalc ? 'text-purple-700' : 'text-gray-700'}`}>
                📊 Записати в калькулятор виробництва
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                Зберегти розрахунок собівартості для подальшого ціноутворення
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
              <span>⚠️</span> {error}
            </div>
          )}
        </div>

        {/* Підсумок і кнопки */}
        <div className="px-6 py-4 border-t bg-gray-50 shrink-0 space-y-3">
          {totalInputCost > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Вартість сировини', value: `${totalInputCost.toFixed(2)} ₴`, color: 'text-gray-700' },
                { label: 'Вага виходу', value: `${totalOutputQty.toFixed(3)} кг`, color: 'text-gray-700' },
                { label: 'Собівартість', value: `${costPerKg.toFixed(2)} ₴/кг`, color: 'text-purple-700' },
                { label: 'Вихід', value: `${yieldPct.toFixed(1)}%`, color: yieldPct >= 80 ? 'text-green-600' : yieldPct >= 60 ? 'text-orange-500' : 'text-red-500' },
              ].map((c) => (
                <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{c.label}</div>
                  <div className={`text-sm font-bold ${c.color}`}>{c.value}</div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-100 transition-colors">Скасувати</button>
            <button onClick={handleSave} disabled={loading}
              className="flex-1 bg-purple-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors font-bold">
              {loading ? 'Зберігаю...' : '⚙️ Провести виробництво'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}