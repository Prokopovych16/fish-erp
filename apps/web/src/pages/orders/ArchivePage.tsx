import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { useAuthStore } from '@/store/auth';
import { Order, Form } from '@/types';

function FormBadge({ form }: { form: Form }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      form === 'FORM_1' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
    }`}>
      {form === 'FORM_1' ? 'Ф1' : 'Ф2'}
    </span>
  );
}

// ─── WeightsEditModal ─────────────────────────────────────────────────────────
function WeightsEditModal({ order, onClose, onSaved }: {
  order: Order; onClose: () => void; onSaved: (updated: Order) => void;
}) {
  const queryClient = useQueryClient();
  const [weights, setWeights] = useState<Record<string, string>>(
    Object.fromEntries(order.items.map((i) => [i.id, i.actualWeight ? String(i.actualWeight) : ''])),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const displayNumber = (order as any).numberForm ?? order.number;
  const totalPlanned = order.items.reduce((s, i) => s + Number(i.plannedWeight), 0);
  const totalActual = order.items.reduce((s, i) => s + (Number(weights[i.id]) || 0), 0);
  const totalSum = order.items.reduce((s, i) => {
    if (i.product.unit === 'шт' && !weights[i.id]) return s;
    return s + (Number(weights[i.id]) || 0) * Number(i.pricePerKg ?? 0);
  }, 0);

  const handleSave = async () => {
    setLoading(true); setError('');
    try {
      const items = order.items.filter((i) => weights[i.id] !== '').map((i) => ({ itemId: i.id, actualWeight: Number(weights[i.id]) }));
      const res = await api.patch(`/orders/${order.id}/items`, { items });
      queryClient.invalidateQueries({ queryKey: ['archive'] });
      onSaved(res.data); onClose();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Помилка збереження');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b shrink-0 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-gray-800 text-lg">Редагування ваги — №{displayNumber}</h2>
              <FormBadge form={order.form} />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{order.client.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {order.items.map((item) => {
            const planned = Number(item.plannedWeight);
            const actual = Number(weights[item.id]) || 0;
            const diff = actual - planned;
            const diffPct = planned > 0 ? (diff / planned) * 100 : 0;
            const hasValue = weights[item.id] !== '';
            const price = Number(item.pricePerKg ?? 0);
            const cardColor = hasValue
              ? Math.abs(diffPct) <= 2 ? 'border-green-200 bg-green-50'
              : Math.abs(diffPct) <= 5 ? 'border-yellow-200 bg-yellow-50'
              : 'border-red-200 bg-red-50'
              : 'border-gray-200 bg-gray-50';
            return (
              <div key={item.id} className={`rounded-xl border p-4 transition-all ${cardColor}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-gray-800 text-sm">{item.product.name}</span>
                  {price > 0 && hasValue && actual > 0 && (
                    <span className="text-xs font-bold text-green-600">{(actual * price).toFixed(2)} ₴</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Планова</div>
                    <div className="bg-white/80 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 text-right">{planned.toFixed(3)}</div>
                  </div>
                  <div className="text-gray-300 text-lg shrink-0 mt-4">→</div>
                  <div className="flex-1">
                    <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Фактична</div>
                    <input type="number" step="0.001" min="0" value={weights[item.id]}
                      onChange={(e) => setWeights((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                  </div>
                  <div className="text-xs text-gray-400 shrink-0 mt-5">{item.product.unit}</div>
                </div>
                {hasValue && actual > 0 && (
                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/60">
                    <span className="text-xs text-gray-500">Відхилення:</span>
                    <span className={`text-xs font-bold ${Math.abs(diffPct) <= 2 ? 'text-green-600' : Math.abs(diffPct) <= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {diff > 0 ? '+' : ''}{diff.toFixed(3)} кг ({diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%)
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          {error && <div className="text-red-500 text-sm bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">⚠️ {error}</div>}
        </div>
        <div className="px-5 pt-3 pb-2 shrink-0">
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 grid grid-cols-2 gap-3 text-center">
            <div><div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">План</div><div className="font-bold text-sm text-gray-700">{totalPlanned.toFixed(3)} кг</div></div>
            <div><div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Факт</div><div className={`font-bold text-sm ${totalActual > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{totalActual.toFixed(3)} кг</div></div>
          </div>
          {totalSum > 0 && <div className="mt-2 text-right text-sm"><span className="text-gray-500">Сума (з ПДВ): </span><span className="font-bold text-green-600">{(totalSum * 1.2).toFixed(2)} ₴</span></div>}
        </div>
        <div className="px-5 pb-5 border-t pt-4 flex gap-2 shrink-0">
          <button onClick={() => setWeights(Object.fromEntries(order.items.map((i) => [i.id, String(i.plannedWeight)])))}
            className="border border-gray-200 text-gray-600 text-sm px-3 py-2.5 rounded-xl hover:bg-gray-50 whitespace-nowrap">= План</button>
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

// ─── OrderDetailsModal ────────────────────────────────────────────────────────
function OrderDetailsModal({ order, onClose, onEditWeights, onEdit, onDelete, userRole }: {
  order: Order; onClose: () => void; onEditWeights: (order: Order) => void; onEdit: (order: Order) => void; onDelete?: (id: string) => void; userRole: string;
}) {
  const queryClient = useQueryClient();
  const [printed, setPrinted] = useState(!!(order as any).printedAt);
  const [printLoading, setPrintLoading] = useState(false);
  const deliveryPoint = (order as any).deliveryPoint;
  const displayNumber = (order as any).numberForm ?? order.number;
  const total = order.items.reduce((s, i) => {
    if (i.product.unit === 'шт' && !i.actualWeight) return s;
    return s + Number(i.actualWeight ?? i.plannedWeight) * Number(i.pricePerKg ?? 0);
  }, 0);
  const totalWeight = order.items.reduce((s, i) => s + Number(i.actualWeight ?? i.plannedWeight), 0);
  const totalPlanned = order.items.reduce((s, i) => s + Number(i.plannedWeight), 0);

  const handlePrint = async (type: 'ttn' | 'quality' | 'invoice' | 'all') => {
    setPrintLoading(true);
    try {
      const r = await api.get(`/documents/order/${order.id}/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      if (!printed) { await api.patch(`/orders/${order.id}/printed`); setPrinted(true); queryClient.invalidateQueries({ queryKey: ['archive'] }); }
    } catch { alert('Помилка генерації документу'); }
    finally { setPrintLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-gray-800 text-xl">№{displayNumber}</h2>
                <FormBadge form={order.form} />
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${order.status === 'DONE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {order.status === 'DONE' ? '✓ Виконано' : '✕ Скасовано'}
                </span>
                {printed && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">✓ Роздруковано</span>}
              </div>
              <div className="text-sm text-gray-600 mt-0.5 font-medium">{order.client.name}</div>
              {deliveryPoint && (
                <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5">
                  <span>📍</span><span className="font-semibold text-gray-700">{deliveryPoint.name}</span>
                </div>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none shrink-0">×</button>
          </div>
        </div>
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {order.driverName && <div className="bg-gray-50 border border-gray-100 rounded-xl p-2.5"><div className="text-xs text-gray-400 mb-0.5">Водій</div><div className="text-sm font-semibold text-gray-700 truncate">🚗 {order.driverName}</div></div>}
            {order.carNumber && <div className="bg-gray-50 border border-gray-100 rounded-xl p-2.5"><div className="text-xs text-gray-400 mb-0.5">Авто</div><div className="text-sm font-semibold text-gray-700">🚛 {order.carNumber}</div></div>}
            {order.createdBy && <div className="bg-gray-50 border border-gray-100 rounded-xl p-2.5"><div className="text-xs text-gray-400 mb-0.5">Створив</div><div className="text-sm font-semibold text-gray-700 truncate">{order.createdBy.name}</div></div>}
            {order.completedAt && <div className="bg-green-50 border border-green-100 rounded-xl p-2.5"><div className="text-xs text-green-500 mb-0.5">Виконано</div><div className="text-sm font-semibold text-green-700">{new Date(order.completedAt).toLocaleDateString('uk-UA')}</div></div>}
          </div>
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Позиції</div>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-xs text-gray-400">
                    <th className="px-3 py-2.5 font-semibold">Товар</th>
                    <th className="px-3 py-2.5 font-semibold text-right">План</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Факт</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Ціна</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Сума</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {order.items.map((item) => {
                    const weight = Number(item.actualWeight ?? item.plannedWeight);
                    const price = Number(item.pricePerKg ?? 0);
                    const planned = Number(item.plannedWeight);
                    const canCalcPrice = item.product.unit !== 'шт' || !!item.actualWeight;
                    const diff = item.actualWeight ? Number(item.actualWeight) - planned : null;
                    const diffPct = diff !== null && planned > 0 ? (diff / planned) * 100 : null;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2.5 font-semibold text-gray-800">{item.product.name}</td>
                        <td className="px-3 py-2.5 text-right text-gray-400 text-xs">{planned.toFixed(3)}</td>
                        <td className="px-3 py-2.5 text-right">
                          {item.actualWeight ? (
                            <div>
                              <span className="font-semibold text-gray-800">{Number(item.actualWeight).toFixed(3)}</span>
                              {diffPct !== null && (
                                <span className={`ml-1 text-xs ${Math.abs(diffPct) <= 2 ? 'text-green-500' : Math.abs(diffPct) <= 5 ? 'text-yellow-500' : 'text-red-500'}`}>
                                  ({diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%)
                                </span>
                              )}
                            </div>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-500 text-xs">{canCalcPrice && price > 0 ? `${(price * 1.2).toFixed(2)} ₴` : '—'}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-gray-800">{canCalcPrice && weight * price > 0 ? `${(weight * price * 1.2).toFixed(2)} ₴` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr className="text-sm font-bold text-gray-700">
                    <td className="px-3 py-2.5">Всього</td>
                    <td className="px-3 py-2.5 text-right text-gray-400 text-xs font-normal">{totalPlanned.toFixed(3)}</td>
                    <td className="px-3 py-2.5 text-right">{totalWeight.toFixed(3)}</td>
                    <td className="px-3 py-2.5 text-right">—</td>
                    <td className="px-3 py-2.5 text-right text-green-600">{(total * 1.2).toFixed(2)} ₴</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          {order.note && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <div className="text-xs font-bold text-amber-500 mb-0.5">Примітка</div>
              <div className="text-sm text-gray-700">{order.note}</div>
            </div>
          )}
        </div>
        <div className="px-5 pb-5 pt-4 border-t shrink-0 space-y-2">
          {userRole === 'ADMIN' && order.status === 'DONE' && (
            <>
              <button onClick={() => handlePrint('all')} disabled={printLoading}
                className="w-full bg-green-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50 font-bold">
                🖨️ {printLoading ? 'Генерую...' : 'Роздрукувати все (5 сторінок)'}
              </button>
              <div className="grid grid-cols-3 gap-2">
                {[{ type: 'invoice' as const, label: '📄 Накладна', cls: 'bg-blue-600 hover:bg-blue-700' },
                  { type: 'ttn' as const, label: '🚚 ТТН', cls: 'bg-gray-600 hover:bg-gray-700' },
                  { type: 'quality' as const, label: '✅ Якісне', cls: 'bg-gray-600 hover:bg-gray-700' }].map((btn) => (
                  <button key={btn.type} onClick={() => handlePrint(btn.type)} disabled={printLoading}
                    className={`${btn.cls} text-white text-xs px-3 py-2 rounded-xl disabled:opacity-50 font-semibold`}>{btn.label}</button>
                ))}
              </div>
              <button onClick={() => onEdit(order)}
                className="w-full border border-blue-200 text-blue-700 text-sm px-4 py-2.5 rounded-xl hover:bg-blue-50 font-semibold">
                ✏️ Редагувати заявку
              </button>
              <button onClick={() => onEditWeights(order)}
                className="w-full border border-yellow-200 text-yellow-700 text-sm px-4 py-2.5 rounded-xl hover:bg-yellow-50 font-semibold">
                ⚖️ Редагувати фактичну вагу
              </button>
            </>
          )}
          {userRole === 'ADMIN' && onDelete && (
            <button onClick={() => onDelete(order.id)}
              className="w-full border border-red-300 text-red-600 text-sm px-4 py-2.5 rounded-xl hover:bg-red-50 font-semibold">🗑 Видалити заявку</button>
          )}
          <button onClick={onClose} className="w-full border border-gray-200 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50">Закрити</button>
        </div>
      </div>
    </div>
  );
}

// ─── ReportDatePicker — вибір діапазону дат для звітів ────────────────────────
function ReportDatePicker({ from, to, onFromChange, onToChange, onPrint, loading, label, extra }: {
  from: string; to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onPrint: () => void;
  loading: boolean;
  label: string;
  extra?: React.ReactNode;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Період для звіту</div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end sm:gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Від</label>
          <input type="date" value={from} onChange={(e) => onFromChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">До</label>
          <input type="date" value={to} onChange={(e) => onToChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-1.5 col-span-2 sm:col-span-1">
          <button onClick={() => { onFromChange(firstOfMonth); onToChange(today); }}
            className="flex-1 sm:flex-none text-xs border border-gray-200 text-gray-600 px-2.5 py-2 rounded-lg hover:bg-gray-50">Цей місяць</button>
          <button onClick={() => {
            const d = new Date(); d.setMonth(d.getMonth() - 1);
            const f = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
            const t = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
            onFromChange(f); onToChange(t);
          }} className="flex-1 sm:flex-none text-xs border border-gray-200 text-gray-600 px-2.5 py-2 rounded-lg hover:bg-gray-50">Мин. місяць</button>
        </div>
        {extra && <div className="col-span-2 sm:col-span-1">{extra}</div>}
        <button onClick={onPrint} disabled={loading || !from || !to}
          className="col-span-2 sm:col-span-1 bg-blue-600 text-white text-sm px-4 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold flex items-center justify-center gap-2">
          {loading ? '⏳ Генерую...' : `🖨️ ${label}`}
        </button>
      </div>
    </div>
  );
}

// ─── RegistryTab ──────────────────────────────────────────────────────────────
function RegistryTab() {
  const { user } = useAuthStore();
  const isInspector = user?.role === 'INSPECTOR';
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [formFilter, setFormFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePrint = async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      const effectiveForm = isInspector ? 'FORM_1' : formFilter;
      if (effectiveForm) params.append('form', effectiveForm);
      const r = await api.get(`/documents/reports/registry?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch { alert('Помилка генерації'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <ReportDatePicker
        from={from} to={to}
        onFromChange={setFrom} onToChange={setTo}
        onPrint={handlePrint} loading={loading}
        label="Роздрукувати реєстр"
        extra={!isInspector ? (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Форма</label>
            <select value={formFilter} onChange={(e) => setFormFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Всі форми</option>
              <option value="FORM_1">Ф1 (безнал)</option>
              <option value="FORM_2">Ф2 (готівка)</option>
            </select>
          </div>
        ) : undefined}
      />
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-semibold mb-1">📋 Реєстр накладних</p>
        <p className="text-xs text-blue-500">Зведений список всіх виконаних заявок за обраний період: номер накладної, клієнт, точка доставки, форма, дата, сума. Підсумки по Ф1/Ф2 і загальний підсумок.</p>
      </div>
    </div>
  );
}

// ─── SuppliersTab ─────────────────────────────────────────────────────────────
function SuppliersTab() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePrint = async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const r = await api.get(`/documents/reports/suppliers?from=${from}&to=${to}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch { alert('Помилка генерації'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <ReportDatePicker
        from={from} to={to}
        onFromChange={setFrom} onToChange={setTo}
        onPrint={handlePrint} loading={loading}
        label="Роздрукувати звіт"
      />
      <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-sm text-green-700">
        <p className="font-semibold mb-1">💰 Звіт по постачальниках</p>
        <p className="text-xs text-green-600">Детальний звіт для бухгалтерії: по кожному постачальнику — продукти, кількість, ціна з ПДВ, сума. Всі суми до копійки. Загальний підсумок в кінці.</p>
      </div>
    </div>
  );
}

// ─── EditArchiveOrderModal ────────────────────────────────────────────────────
function EditArchiveOrderModal({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const displayNumber = (order as any).numberForm ?? order.number;

  const [clientId, setClientId] = useState(order.clientId);
  const [numberFormVal, setNumberFormVal] = useState(String((order as any).numberForm ?? ''));
  const [driverName, setDriverName] = useState(order.driverName || '');
  const [carNumber, setCarNumber] = useState(order.carNumber || '');
  const [deliveryPointId, setDeliveryPointId] = useState((order as any).deliveryPointId || '');
  const [note, setNote] = useState(order.note || '');
  const [invoiceDate, setInvoiceDate] = useState(
    (order as any).invoiceDate ? new Date((order as any).invoiceDate).toISOString().slice(0, 10) : '',
  );
  const [plannedDate, setPlannedDate] = useState(
    (order as any).plannedDate ? new Date((order as any).plannedDate).toISOString().slice(0, 10) : '',
  );
  const [items, setItems] = useState(
    order.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.product.name,
      productUnit: i.product.unit,
      plannedWeight: String(i.plannedWeight),
      actualWeight: i.actualWeight != null ? String(i.actualWeight) : '',
      displayUnit: (i as any).displayUnit || i.product?.unit || 'кг',
      pricePerKg: Number(i.pricePerKg ?? 0),
    })),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: () => api.get('/clients').then((r) => r.data) });
  const { data: drivers = [] } = useQuery({ queryKey: ['drivers'], queryFn: () => api.get('/drivers').then((r) => r.data) });
  const { data: cars = [] } = useQuery({ queryKey: ['cars'], queryFn: () => api.get('/cars').then((r) => r.data) });
  const { data: deliveryPoints = [] } = useQuery({
    queryKey: ['delivery-points', clientId],
    queryFn: () => api.get(`/clients/${clientId}/delivery-points`).then((r) => r.data),
    enabled: !!clientId,
  });

  const handleSave = async () => {
    if (!clientId) return setError('Оберіть клієнта');
    setLoading(true); setError('');
    try {
      await api.patch(`/orders/${order.id}`, {
        clientId,
        numberForm: numberFormVal ? Number(numberFormVal) : undefined,
        driverName: driverName || undefined,
        carNumber: carNumber || undefined,
        deliveryPointId: deliveryPointId || undefined,
        note: note || undefined,
        plannedDate: plannedDate || undefined,
        invoiceDate: invoiceDate || undefined,
      });
      // Зберігаємо фактичні ваги окремо
      const weightItems = items.filter((i) => i.actualWeight !== '').map((i) => ({ itemId: i.id, actualWeight: Number(i.actualWeight) }));
      if (weightItems.length > 0) {
        await api.patch(`/orders/${order.id}/items`, { items: weightItems });
      }
      queryClient.invalidateQueries({ queryKey: ['archive'] });
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e.response?.data?.message;
      try {
        const parsed = JSON.parse(msg);
        if (parsed.type === 'DUPLICATE_NUMBER') {
          setError(`⚠️ Накладна №${parsed.numberForm} вже існує. Змініть номер.`);
        } else {
          setError(msg || 'Помилка збереження');
        }
      } catch {
        setError(msg || 'Помилка збереження');
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">Редагування №{displayNumber}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              <FormBadge form={order.form} />
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Номер накладної</label>
            <input type="number" min="1" value={numberFormVal}
              onChange={(e) => setNumberFormVal(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Клієнт *</label>
            <select value={clientId} onChange={(e) => { setClientId(e.target.value); setDeliveryPointId(''); }}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Оберіть клієнта...</option>
              {(clients as any[])?.filter((c: any) => c.isActive).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {clientId && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Точка доставки</label>
              <select value={deliveryPointId} onChange={(e) => setDeliveryPointId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Не вказано</option>
                {(deliveryPoints as any[]).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Водій</label>
              <select value={driverName} onChange={(e) => setDriverName(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Оберіть...</option>
                {(drivers as any[]).filter((d: any) => d.isActive).map((d: any) => <option key={d.id} value={d.name}>🚗 {d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Авто</label>
              <select value={carNumber} onChange={(e) => setCarNumber(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Оберіть...</option>
                {(cars as any[]).filter((c: any) => c.isActive).map((c: any) => <option key={c.id} value={c.number}>🚛 {c.number}{c.brand ? ` · ${c.brand}` : ''}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Дата накладної</label>
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Планова дата</label>
              <input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Примітка</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Фактичні ваги</label>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.id} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-gray-700 mb-1">{item.productName}</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="text-[10px] text-gray-400 mb-0.5">Планова</div>
                          <input type="number" step="0.001" min="0" value={item.plannedWeight}
                            onChange={(e) => setItems((prev) => prev.map((p, i) => i === idx ? { ...p, plannedWeight: e.target.value } : p))}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                        </div>
                        <div className="text-gray-300 mt-4">→</div>
                        <div className="flex-1">
                          <div className="text-[10px] text-gray-400 mb-0.5">Фактична</div>
                          <input type="number" step="0.001" min="0" value={item.actualWeight}
                            onChange={(e) => setItems((prev) => prev.map((p, i) => i === idx ? { ...p, actualWeight: e.target.value } : p))}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                        </div>
                        <div className="text-xs text-gray-400 mt-4">{item.productUnit}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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

// ─── ArchivePage ──────────────────────────────────────────────────────────────
export default function ArchivePage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'orders' | 'registry' | 'suppliers'>('orders');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editingFullOrder, setEditingFullOrder] = useState<Order | null>(null);
  const [form, setForm] = useState<Form | ''>('');
  const [clientId, setClientId] = useState('');
  const [number, setNumber] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const isInspector = user?.role === 'INSPECTOR';

  const { data, isLoading } = useQuery({
    queryKey: ['archive', form, clientId, number, from, to, page, isInspector],
    queryFn: () => api.get('/orders/archive', {
      params: {
        ...(isInspector ? { form: 'FORM_1' } : form && { form }),
        ...(clientId && { clientId }), ...(number && { number }), ...(from && { from }), ...(to && { to }), page, limit: 20,
      },
    }).then((r) => r.data),
    enabled: activeTab === 'orders',
  });

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients').then((r) => r.data),
  });

  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/orders/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['archive'] }); setSelectedOrder(null); },
    onError: (error: { response?: { data?: { message?: string } } }) => { alert(error.response?.data?.message || 'Помилка видалення'); },
  });

  const orders: Order[] = data?.data || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;
  const hasFilters = !!(form || clientId || number || from || to);

  const resetFilters = () => { setForm(''); setClientId(''); setNumber(''); setFrom(''); setTo(''); setPage(1); };

  const getPaginationPages = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  const handleWeightsSaved = (updated: Order) => { setSelectedOrder(updated); setEditingOrder(null); };

  const TABS = [
    { id: 'orders', label: '📋 Накладні' },
    { id: 'registry', label: '🖨️ Реєстр' },
    { id: 'suppliers', label: '💰 По постачальниках' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Архів заявок</h1>
          {activeTab === 'orders' && total > 0 && <p className="text-xs text-gray-400 mt-0.5">Знайдено: {total} заявок</p>}
        </div>
        {activeTab === 'orders' && (
          <button onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
              showFilters || hasFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}>
            🔍 Фільтри
            {hasFilters && <span className="bg-white text-blue-600 text-xs px-1.5 py-0.5 rounded-full font-bold">{[form, clientId, number, from, to].filter(Boolean).length}</span>}
          </button>
        )}
      </div>

      {/* Вкладки */}
      <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm w-full sm:w-fit bg-white">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 font-medium transition-colors whitespace-nowrap text-xs sm:text-sm ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Вкладка: Накладні */}
      {activeTab === 'orders' && (
        <>
          {showFilters && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {user?.role !== 'INSPECTOR' && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Форма</label>
                    <select value={form} onChange={(e) => { setForm(e.target.value as Form | ''); setPage(1); }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Всі форми</option>
                      <option value="FORM_1">Форма 1 (безнал)</option>
                      <option value="FORM_2">Форма 2 (готівка)</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Клієнт</label>
                  <select value={clientId} onChange={(e) => { setClientId(e.target.value); setPage(1); }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Всі клієнти</option>
                    {clients?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Номер</label>
                  <input type="number" value={number} onChange={(e) => { setNumber(e.target.value); setPage(1); }}
                    placeholder="№ накладної"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Від</label>
                  <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">До</label>
                  <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              {hasFilters && <button onClick={resetFilters} className="text-xs text-red-500 hover:text-red-700">× Скинути фільтри</button>}
            </div>
          )}

          {isLoading ? (
            <div className="text-center text-gray-400 py-12">Завантаження...</div>
          ) : orders.length === 0 ? (
            <div className="text-center text-gray-400 py-16 border-2 border-dashed border-gray-200 rounded-xl">
              <div className="text-4xl mb-3">📭</div>
              <div className="font-medium text-gray-500">Заявок не знайдено</div>
              {hasFilters && <button onClick={resetFilters} className="mt-2 text-xs text-blue-500 hover:text-blue-700">Скинути фільтри</button>}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Мобільний вид — картки */}
              <div className="sm:hidden divide-y divide-gray-100">
                {orders.map((order) => {
                  const orderTotal = order.items.reduce((s, i) => {
                    if (i.product.unit === 'шт' && !i.actualWeight) return s;
                    return s + Number(i.actualWeight ?? i.plannedWeight) * Number(i.pricePerKg ?? 0);
                  }, 0);
                  const orderWeight = order.items.reduce((s, i) => s + Number(i.actualWeight ?? i.plannedWeight), 0);
                  const extOrder = order as Order & { printedAt?: string; numberForm?: number; deliveryPoint?: { name: string } };
                  const isPrinted = !!extOrder.printedAt;
                  const displayNumber = extOrder.numberForm ?? order.number;
                  return (
                    <div key={order.id} onClick={() => setSelectedOrder(order)}
                      className="p-4 active:bg-blue-50/50 cursor-pointer">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-gray-800">№{displayNumber}</span>
                          {isPrinted && <span className="text-purple-400 text-xs font-bold">✓</span>}
                          <FormBadge form={order.form} />
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${order.status === 'DONE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {order.status === 'DONE' ? '✓ Виконано' : '✕ Скасовано'}
                          </span>
                        </div>
                        <span className="font-bold text-green-600 text-sm shrink-0">{(orderTotal * 1.2).toFixed(0)} ₴</span>
                      </div>
                      <div className="text-sm text-gray-700 font-medium truncate">{order.client.name}</div>
                      {extOrder.deliveryPoint && <div className="text-xs text-gray-400">📍 {extOrder.deliveryPoint.name}</div>}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                        <span>{orderWeight.toFixed(1)} кг</span>
                        <span>·</span>
                        <span>{new Date(order.createdAt).toLocaleDateString('uk-UA')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Десктопний вид — таблиця */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-xs text-gray-500">
                      <th className="px-4 py-3 font-semibold">№</th>
                      <th className="px-4 py-3 font-semibold">Клієнт</th>
                      <th className="px-4 py-3 font-semibold">Форма</th>
                      <th className="px-4 py-3 font-semibold">Статус</th>
                      <th className="px-4 py-3 font-semibold text-right">Вага</th>
                      <th className="px-4 py-3 font-semibold text-right">Сума</th>
                      <th className="px-4 py-3 font-semibold text-right">Дата</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders.map((order) => {
                      const extOrd = order as Order & { printedAt?: string; numberForm?: number; deliveryPoint?: { name: string } };
                      const orderTotal = order.items.reduce((s, i) => {
                        if (i.product.unit === 'шт' && !i.actualWeight) return s;
                        return s + Number(i.actualWeight ?? i.plannedWeight) * Number(i.pricePerKg ?? 0);
                      }, 0);
                      const orderWeight = order.items.reduce((s, i) => s + Number(i.actualWeight ?? i.plannedWeight), 0);
                      const isPrinted = !!extOrd.printedAt;
                      const displayNumber = extOrd.numberForm ?? order.number;
                      return (
                        <tr key={order.id} onClick={() => setSelectedOrder(order)}
                          className="hover:bg-blue-50/50 cursor-pointer transition-colors group">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">№{displayNumber}</span>
                              {isPrinted && <span className="text-purple-400 text-xs font-bold">✓</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 max-w-[160px]">
                            <span className="truncate block text-gray-700 font-medium">{order.client.name}</span>
                            {extOrd.deliveryPoint && <span className="text-[10px] text-gray-400">📍 {extOrd.deliveryPoint.name}</span>}
                          </td>
                          <td className="px-4 py-3"><FormBadge form={order.form} /></td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${order.status === 'DONE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {order.status === 'DONE' ? '✓ Виконано' : '✕ Скасовано'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600 text-xs font-medium">{orderWeight.toFixed(1)} кг</td>
                          <td className="px-4 py-3 text-right"><span className="font-bold text-green-600">{(orderTotal * 1.2).toFixed(2)} ₴</span></td>
                          <td className="px-4 py-3 text-right text-gray-400 text-xs">{new Date(order.createdAt).toLocaleDateString('uk-UA')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                  <div className="text-xs text-gray-500">{total} заявок · сторінка {page} з {totalPages}</div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">←</button>
                    {getPaginationPages().map((p, i) =>
                      p === '...' ? <span key={`dots-${i}`} className="px-2 text-gray-400 text-sm">…</span> : (
                        <button key={p} onClick={() => setPage(p as number)}
                          className={`w-8 h-8 text-xs rounded-lg border transition-colors ${p === page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                          {p}
                        </button>
                      )
                    )}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">→</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'registry' && <RegistryTab />}
      {activeTab === 'suppliers' && <SuppliersTab />}

      {selectedOrder && !editingOrder && !editingFullOrder && (
        <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)}
          onEditWeights={(order) => setEditingOrder(order)}
          onEdit={(order) => { setEditingFullOrder(order); setSelectedOrder(null); }}
          onDelete={(id) => { if (window.confirm('Видалити заявку? Це незворотно.')) deleteMutation.mutate(id); }}
          userRole={user?.role || ''} />
      )}
      {editingOrder && (
        <WeightsEditModal order={editingOrder} onClose={() => setEditingOrder(null)} onSaved={handleWeightsSaved} />
      )}
      {editingFullOrder && (
        <EditArchiveOrderModal order={editingFullOrder} onClose={() => setEditingFullOrder(null)}
          onSaved={() => setEditingFullOrder(null)} />
      )}
    </div>
  );
}
