// ─── Замінити ProductionModal в WarehousePage.tsx ────────────────────────────
// Видали форму з рядків сировини (береться з складу автоматично)
// Видали ціну з рядків готової продукції (рахується як собівартість)
// Додай чекбокс "Записати в калькулятор"

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';

type WarehouseType = 'RAW_MATERIAL' | 'IN_PRODUCTION' | 'FINISHED_GOODS' | 'FRIDGE' | 'SUPPLIES';

const warehouseTypeIcon: Record<WarehouseType, string> = {
  RAW_MATERIAL: '🐟', IN_PRODUCTION: '⚙️', FINISHED_GOODS: '📦', FRIDGE: '❄️', SUPPLIES: '🧴',
};

export function ProductionModal({ onClose, initialItem, editCalcId, initialNote, initialCalcData }: {
  onClose: () => void;
  initialItem?: { warehouseId: string; stockItemId: string; quantity: string };
  editCalcId?: string;
  initialNote?: string;
  initialCalcData?: {
    inputs: Array<{ productName: string; quantity: number; supplierName: string | null }>;
    outputs: Array<{ productName: string; quantity: number }>;
  };
}) {
  const isEditMode = !!editCalcId;
  const queryClient = useQueryClient();

  const [inputs, setInputs] = useState([
    initialItem ?? { warehouseId: '', stockItemId: '', quantity: '' },
  ]);
  const [outputs, setOutputs] = useState([
    { productId: '', quantity: '' },
  ]);
  const [note, setNote] = useState(initialNote ?? '');
  const [saveToCalc, setSaveToCalc] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const inputsInitRef = useRef(false);
  const outputsInitRef = useRef(false);

  const { data: stock = [] } = useQuery({
    queryKey: ['stock'],
    queryFn: () => api.get('/warehouses/stock/all').then((r) => r.data),
  });
  const { data: products = [] } = useQuery({
    queryKey: ['products-active'],
    queryFn: () => api.get('/products/active').then((r) => r.data),
  });

  const activeWarehouses = (stock as any[]).filter((w: any) => w.isActive);

  // Auto-fill inputs від calc даних (підбираємо партії по назві продукту + постачальнику)
  useEffect(() => {
    if (!initialCalcData || inputsInitRef.current || !(stock as any[]).length) return;
    inputsInitRef.current = true;
    const matched = initialCalcData.inputs.map((inp) => {
      let foundWarehouseId = '';
      let foundStockItemId = '';
      for (const wh of activeWarehouses) {
        for (const item of ((wh.stockItems || []) as any[])) {
          if (item.product?.name === inp.productName) {
            if (!inp.supplierName || item.supplier?.name === inp.supplierName) {
              foundWarehouseId = wh.id;
              foundStockItemId = item.id;
              break;
            }
          }
        }
        if (foundWarehouseId) break;
      }
      return { warehouseId: foundWarehouseId, stockItemId: foundStockItemId, quantity: String(inp.quantity) };
    });
    if (matched.length) setInputs(matched);
  }, [stock]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill outputs від calc даних (підбираємо productId по назві)
  useEffect(() => {
    if (!initialCalcData || outputsInitRef.current || !(products as any[]).length) return;
    outputsInitRef.current = true;
    const matched = initialCalcData.outputs.map((out) => {
      const prod = (products as any[]).find((p: any) => p.name === out.productName);
      return { productId: prod?.id ?? '', quantity: String(out.quantity) };
    });
    if (matched.length) setOutputs(matched);
  }, [products]); // eslint-disable-line react-hooks/exhaustive-deps

  const getBatches = (warehouseId: string) => {
    if (!warehouseId) return [];
    const wh = activeWarehouses.find((w: any) => w.id === warehouseId);
    return ((wh?.stockItems || []) as any[]).filter((i: any) => Number(i.quantity) > 0);
  };

  const getBatch = (warehouseId: string, stockItemId: string) => {
    if (!stockItemId) return null;
    return getBatches(warehouseId).find((i: any) => i.id === stockItemId) ?? null;
  };

  const addInput = () => setInputs(prev => [...prev, { warehouseId: '', stockItemId: '', quantity: '' }]);
  const removeInput = (idx: number) => setInputs(prev => prev.filter((_, i) => i !== idx));
  const updateInput = (idx: number, key: string, val: string) =>
    setInputs(prev => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));

  const addOutput = () => setOutputs(prev => [...prev, { productId: '', quantity: '' }]);
  const removeOutput = (idx: number) => setOutputs(prev => prev.filter((_, i) => i !== idx));
  const updateOutput = (idx: number, key: string, val: string) =>
    setOutputs(prev => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));

  const totalInputCost = inputs.reduce((s, r) => {
    const batch = getBatch(r.warehouseId, r.stockItemId);
    return s + (Number(r.quantity) || 0) * Number(batch?.pricePerKg ?? 0);
  }, 0);
  const totalInputQty = inputs.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const totalOutputQty = outputs.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const costPerKg = totalOutputQty > 0 ? totalInputCost / totalOutputQty : 0;
  const yieldPct = totalInputQty > 0 ? (totalOutputQty / totalInputQty) * 100 : 0;

  const handleSave = async () => {
    if (inputs.some(r => !r.warehouseId || !r.stockItemId || !r.quantity)) return setError('Оберіть склад, партію і кількість для кожного рядка сировини');
    if (outputs.some(r => !r.productId || !r.quantity)) return setError('Заповніть всі рядки готової продукції');
    setLoading(true);
    setError('');
    try {
      if (isEditMode) {
        // ── РЕЖИМ РЕДАГУВАННЯ ────────────────────────────────────────────
        await api.patch(`/production-calc/${editCalcId}`, {
          inputs: inputs.map(r => {
            const batch = getBatch(r.warehouseId, r.stockItemId);
            return {
              warehouseId: r.warehouseId,
              productId: batch?.productId ?? '',
              quantity: Number(r.quantity),
              form: batch?.form ?? 'FORM_1',
              stockItemId: r.stockItemId,
            };
          }),
          outputs: outputs.map(r => ({
            productId: r.productId,
            quantity: Number(r.quantity),
            form: 'FORM_1',
            pricePerKg: costPerKg,
          })),
          calcInputs: inputs.map(r => {
            const batch = getBatch(r.warehouseId, r.stockItemId);
            return {
              productName: batch?.product?.name ?? r.stockItemId,
              quantity: Number(r.quantity),
              pricePerKg: Number(batch?.pricePerKg ?? 0),
              form: batch?.form ?? 'FORM_1',
              supplierName: batch?.supplier?.name ?? null,
            };
          }),
          calcOutputs: outputs.map(r => {
            const prod = (products as any[]).find((p: any) => p.id === r.productId);
            return {
              productName: prod?.name ?? r.productId,
              quantity: Number(r.quantity),
              form: 'FORM_1',
            };
          }),
          note: note || undefined,
        });
      } else {
        // ── РЕЖИМ СТВОРЕННЯ ──────────────────────────────────────────────
        const warehousePayload: any = {
          inputs: inputs.map(r => {
            const batch = getBatch(r.warehouseId, r.stockItemId);
            return {
              warehouseId: r.warehouseId,
              productId: batch?.productId ?? '',
              quantity: Number(r.quantity),
              form: batch?.form ?? 'FORM_1',
              stockItemId: r.stockItemId,
            };
          }),
          outputs: outputs.map(r => ({
            productId: r.productId,
            quantity: Number(r.quantity),
            form: 'FORM_1',
            pricePerKg: costPerKg,
          })),
          note: note || undefined,
        };

        // Якщо saveToCalc: спочатку calc (щоб отримати id), потім warehouse з calcId
        if (saveToCalc) {
          const calcResp = await api.post('/production-calc', {
            note: note || undefined,
            inputs: inputs.map(r => {
              const batch = getBatch(r.warehouseId, r.stockItemId);
              return {
                productName: batch?.product?.name ?? r.stockItemId,
                quantity: Number(r.quantity),
                pricePerKg: Number(batch?.pricePerKg ?? 0),
                form: batch?.form ?? 'FORM_1',
                supplierName: batch?.supplier?.name ?? null,
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
          warehousePayload.calcId = calcResp.data.id;
        }

        await api.post('/warehouses/production', warehousePayload);
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
              <h2 className="font-bold text-gray-800 text-lg">
                {isEditMode ? 'Редагувати виробництво' : 'Виробництво'}
              </h2>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {isEditMode
                ? 'Вкажіть нові дані — склад буде скориговано автоматично'
                : 'Спишіть сировину і вкажіть готову продукцію'}
            </p>
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
                const batches = getBatches(row.warehouseId);
                const batch = getBatch(row.warehouseId, row.stockItemId);
                const qty = Number(row.quantity) || 0;
                const isOver = batch && qty > Number(batch.quantity);
                const lineCost = qty * Number(batch?.pricePerKg ?? 0);

                return (
                  <div key={idx} className={`rounded-xl border p-3 transition-all ${isOver ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Склад</div>
                        <select value={row.warehouseId}
                          onChange={(e) => setInputs(prev => prev.map((r, i) => i === idx ? { ...r, warehouseId: e.target.value, stockItemId: '' } : r))}
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                          <option value="">Оберіть...</option>
                          {activeWarehouses.map((w: any) => (
                            <option key={w.id} value={w.id}>{warehouseTypeIcon[w.type as WarehouseType]} {w.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-5">
                        <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Партія</div>
                        <select value={row.stockItemId} onChange={(e) => updateInput(idx, 'stockItemId', e.target.value)}
                          disabled={!row.warehouseId}
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50">
                          <option value="">Оберіть партію...</option>
                          {batches.map((b: any) => (
                            <option key={b.id} value={b.id}>
                              {b.product?.name}{b.supplier?.name ? ` · ${b.supplier.name}` : ''} — {Number(b.pricePerKg ?? 0).toFixed(2)} ₴ ({Number(b.quantity).toFixed(3)} кг)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">кг</div>
                        <input type="number" step="0.001" min="0" value={row.quantity}
                          onChange={(e) => updateInput(idx, 'quantity', e.target.value)}
                          placeholder="0.000"
                          className={`w-full border rounded-lg px-2 py-2 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${isOver ? 'border-red-300' : 'border-gray-300'}`} />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {inputs.length > 1 && (
                          <button onClick={() => removeInput(idx)} className="text-red-400 hover:text-red-600 text-lg">×</button>
                        )}
                      </div>
                    </div>

                    {batch && (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className={`${batch.form === 'FORM_1' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'} px-2 py-0.5 rounded-full font-semibold`}>
                          {batch.form === 'FORM_1' ? 'Ф1' : 'Ф2'}
                        </span>
                        {batch.supplier?.name && (
                          <span className="bg-purple-50 border border-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                            {batch.supplier.name}
                          </span>
                        )}
                        <span className="text-gray-500">Доступно: <b>{Number(batch.quantity).toFixed(3)} кг</b></span>
                        {Number(batch.pricePerKg) > 0 && <span className="text-gray-500">Ціна: <b>{Number(batch.pricePerKg).toFixed(2)} ₴/кг</b></span>}
                        {lineCost > 0 && <span className="text-green-600 font-semibold">= {lineCost.toFixed(2)} ₴</span>}
                        {isOver && <span className="text-red-500 font-semibold">⚠️ не вистачає {(qty - Number(batch.quantity)).toFixed(3)} кг</span>}
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
                  <div className="text-xs text-purple-600">Вхід: <b>{totalInputCost.toFixed(2)} ₴</b></div>
                  <div className="text-xs text-purple-600">Собівартість: <b>{costPerKg.toFixed(4)} ₴/кг</b></div>
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
                const share = totalOutputQty > 0 ? (qty / totalOutputQty) * 100 : 0;

                return (
                  <div key={idx} className="rounded-xl border border-gray-200 bg-green-50/30 p-3">
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-7">
                        <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Готовий продукт</div>
                        <select value={row.productId} onChange={(e) => updateOutput(idx, 'productId', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                          <option value="">Оберіть...</option>
                          {(products as any[]).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="col-span-4">
                        <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Факт. вага кг</div>
                        <input type="number" step="0.001" min="0" value={row.quantity}
                          onChange={(e) => updateOutput(idx, 'quantity', e.target.value)}
                          placeholder="0.000"
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs text-right focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {outputs.length > 1 && (
                          <button onClick={() => removeOutput(idx)} className="text-red-400 hover:text-red-600 text-lg">×</button>
                        )}
                      </div>
                    </div>

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

          {/* Чекбокс — записати в калькулятор (тільки при створенні) */}
          {!isEditMode && (
            <div
              onClick={() => setSaveToCalc(!saveToCalc)}
              className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all select-none ${
                saveToCalc ? 'border-purple-400 bg-purple-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'
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
          )}

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
              className={`flex-1 text-white text-sm px-4 py-2.5 rounded-xl disabled:opacity-50 transition-colors font-bold ${
                isEditMode ? 'bg-amber-500 hover:bg-amber-600' : 'bg-purple-600 hover:bg-purple-700'
              }`}>
              {loading ? 'Зберігаю...' : isEditMode ? '✏️ Зберегти зміни' : '⚙️ Провести виробництво'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
