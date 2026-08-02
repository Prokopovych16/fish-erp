/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { useAuthStore } from '@/store/auth';
import { Order, Form } from '@/types';
import { r2, addVat, parseOrderNum } from '@/utils/finance';

function FormBadge({ form }: { form: Form }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      form === 'FORM_1' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
    }`}>
      {form === 'FORM_1' ? 'Ф1' : 'Ф2'}
    </span>
  );
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Чернетка', PENDING: 'Очікує', IN_PROGRESS: 'В роботі', DONE: 'Виконано', CANCELLED: 'Скасовано',
};
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  PENDING: 'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  DONE: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

function calcOrderTotal(items: Order['items']): number {
  return items.reduce((s, i) => {
    if (i.product.unit === 'шт' && !i.actualWeight) return s;
    return s + r2(Number(i.actualWeight ?? i.plannedWeight) * Number(i.pricePerKg ?? 0));
  }, 0);
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
  const extOrd = order as Order & { numberForm?: number; numberSuffix?: string };
  const displayNumber = String(extOrd.numberForm ?? order.number) + (extOrd.numberSuffix ?? '');
  const totalPlanned = order.items.reduce((s, i) => s + Number(i.plannedWeight), 0);
  const totalActual = order.items.reduce((s, i) => s + (Number(weights[i.id]) || 0), 0);
  const totalUnit = order.items.length > 0 && order.items.every(i => i.product.unit === order.items[0].product.unit) ? order.items[0].product.unit : 'кг';
  const totalSum = order.items.reduce((s, i) => {
    if (i.product.unit === 'шт' && !weights[i.id]) return s;
    return s + r2((Number(weights[i.id]) || 0) * Number(i.pricePerKg ?? 0));
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
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                  </div>
                  <div className="text-xs text-gray-400 shrink-0 mt-5">{item.product.unit}</div>
                </div>
                {hasValue && actual > 0 && (
                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/60">
                    <span className="text-xs text-gray-500">Відхилення:</span>
                    <span className={`text-xs font-bold ${Math.abs(diffPct) <= 2 ? 'text-green-600' : Math.abs(diffPct) <= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {diff > 0 ? '+' : ''}{diff.toFixed(3)} {item.product.unit} ({diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%)
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
            <div><div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">План</div><div className="font-bold text-sm text-gray-700">{totalPlanned.toFixed(3)} {totalUnit}</div></div>
            <div><div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Факт</div><div className={`font-bold text-sm ${totalActual > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{totalActual.toFixed(3)} {totalUnit}</div></div>
          </div>
          {totalSum > 0 && <div className="mt-2 text-right text-sm"><span className="text-gray-500">Сума (з ПДВ): </span><span className="font-bold text-green-600">{addVat(totalSum).toFixed(2)} ₴</span></div>}
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
  const extOrdDet = order as Order & { numberForm?: number; numberSuffix?: string; deliveryPoint?: { name: string; address?: string } };
  const deliveryPoint = extOrdDet.deliveryPoint;
  const displayNumber = String(extOrdDet.numberForm ?? order.number) + (extOrdDet.numberSuffix ?? '');
  const total = calcOrderTotal(order.items);
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

  const canPrint = userRole === 'ADMIN' && order.status === 'DONE';

  const buttons = (
    <>
      {canPrint && (
        <>
          <button onClick={() => handlePrint('all')} disabled={printLoading}
            className="w-full bg-green-600 text-white text-sm px-3 py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50 font-bold">
            🖨️ {printLoading ? 'Генерую...' : 'Все (5 стор.)'}
          </button>
          <div className="grid grid-cols-3 gap-2">
            {[{ type: 'invoice' as const, label: '📄 Накладна', cls: 'bg-blue-600 hover:bg-blue-700' },
              { type: 'ttn' as const, label: '🚚 ТТН', cls: 'bg-gray-600 hover:bg-gray-700' },
              { type: 'quality' as const, label: '✅ Якісне', cls: 'bg-gray-600 hover:bg-gray-700' }].map((btn) => (
              <button key={btn.type} onClick={() => handlePrint(btn.type)} disabled={printLoading}
                className={`${btn.cls} text-white text-xs px-2 py-2.5 rounded-xl disabled:opacity-50 font-semibold`}>{btn.label}</button>
            ))}
          </div>
          <button onClick={() => onEdit(order)}
            className="w-full border border-blue-200 text-blue-700 text-sm px-3 py-2.5 rounded-xl hover:bg-blue-50 font-semibold">✏️ Редагувати</button>
          <button onClick={() => onEditWeights(order)}
            className="w-full border border-yellow-200 text-yellow-700 text-sm px-3 py-2.5 rounded-xl hover:bg-yellow-50 font-semibold">⚖️ Фактична вага</button>
          <div className="border-t border-gray-200" />
        </>
      )}
      {userRole === 'ADMIN' && onDelete && (
        <button onClick={() => onDelete(order.id)}
          className="w-full border border-red-300 text-red-600 text-sm px-3 py-2.5 rounded-xl hover:bg-red-50 font-semibold">🗑 Видалити</button>
      )}
      <button onClick={onClose} className="w-full border border-gray-200 text-gray-600 text-sm px-3 py-2.5 rounded-xl hover:bg-gray-50">Закрити</button>
    </>
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-gray-800 text-xl">№{displayNumber}</h2>
                <FormBadge form={order.form} />
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_COLOR[order.status]}`}>
                  {STATUS_LABEL[order.status]}
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

        {/* Body: two columns on desktop */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
          {/* Left: order content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
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
                      const lineTotal = canCalcPrice && weight * price > 0 ? r2(weight * price) * 1.2 : null;
                      return (
                        <tr key={item.id} className="hover:bg-gray-50/50">
                          <td className="px-3 py-2.5 font-semibold text-gray-800 text-xs">{item.product.name}</td>
                          <td className="px-3 py-2.5 text-right text-gray-400 text-xs">{planned.toFixed(3)}</td>
                          <td className="px-3 py-2.5 text-right">
                            {item.actualWeight ? (
                              <span className="font-semibold text-gray-800 text-xs">
                                {Number(item.actualWeight).toFixed(3)}
                                {diffPct !== null && <span className={`ml-1 ${Math.abs(diffPct) <= 2 ? 'text-green-500' : Math.abs(diffPct) <= 5 ? 'text-yellow-500' : 'text-red-500'}`}>({diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%)</span>}
                              </span>
                            ) : <span className="text-gray-400 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-500 text-xs">{canCalcPrice && price > 0 ? `${(price * 1.2).toFixed(2)} ₴` : '—'}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-gray-800 text-xs">{lineTotal != null ? `${lineTotal.toFixed(2)} ₴` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr className="text-sm font-bold text-gray-700">
                      <td className="px-3 py-2.5 text-xs">Всього</td>
                      <td className="px-3 py-2.5 text-right text-gray-400 text-xs font-normal">{totalPlanned.toFixed(3)}</td>
                      <td className="px-3 py-2.5 text-right text-xs">{totalWeight.toFixed(3)}</td>
                      <td className="px-3 py-2.5 text-right text-xs">—</td>
                      <td className="px-3 py-2.5 text-right text-green-600 text-sm">{(addVat(total)).toFixed(2)} ₴</td>
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
            <div className="md:hidden pt-4 border-t space-y-2">
              {buttons}
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="hidden md:flex md:flex-col md:w-52 shrink-0 md:border-l border-gray-200 p-4 gap-2 bg-gray-50/50">
            {canPrint && (
              <>
                <button onClick={() => handlePrint('all')} disabled={printLoading}
                  className="w-full bg-green-600 text-white text-sm px-3 py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50 font-bold text-center">
                  🖨️ {printLoading ? 'Генерую...' : 'Все (5 стор.)'}
                </button>
                {[{ type: 'invoice' as const, label: '📄 Накладна', cls: 'bg-blue-600 hover:bg-blue-700' },
                  { type: 'ttn' as const, label: '🚚 ТТН', cls: 'bg-gray-600 hover:bg-gray-700' },
                  { type: 'quality' as const, label: '✅ Якісне', cls: 'bg-gray-600 hover:bg-gray-700' }].map((btn) => (
                  <button key={btn.type} onClick={() => handlePrint(btn.type)} disabled={printLoading}
                    className={`w-full ${btn.cls} text-white text-sm px-3 py-2.5 rounded-xl disabled:opacity-50 font-semibold`}>{btn.label}</button>
                ))}
                <div className="border-t border-gray-200 my-1" />
                <button onClick={() => onEdit(order)}
                  className="w-full border border-blue-200 text-blue-700 text-sm px-3 py-2.5 rounded-xl hover:bg-blue-50 font-semibold">
                  ✏️ Редагувати
                </button>
                <button onClick={() => onEditWeights(order)}
                  className="w-full border border-yellow-200 text-yellow-700 text-sm px-3 py-2.5 rounded-xl hover:bg-yellow-50 font-semibold">
                  ⚖️ Фактична вага
                </button>
              </>
            )}
            {userRole === 'ADMIN' && onDelete && (
              <button onClick={() => onDelete(order.id)}
                className="w-full border border-red-300 text-red-600 text-sm px-3 py-2.5 rounded-xl hover:bg-red-50 font-semibold">
                🗑 Видалити
              </button>
            )}
            <div className="flex-1" />
            <button onClick={onClose} className="w-full border border-gray-200 text-gray-600 text-sm px-3 py-2.5 rounded-xl hover:bg-gray-50">
              Закрити
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ShortcutBar({ setFrom, setTo, accent = 'emerald' }: {
  setFrom: (v: string) => void; setTo: (v: string) => void; accent?: 'emerald' | 'blue';
}) {
  const n = new Date();
  const colors = accent === 'blue'
    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 active:bg-blue-200'
    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 active:bg-emerald-200';
  const shortcuts = [
    { label: 'Сьогодні', apply: () => { const d = localDateStr(n); setFrom(d); setTo(d); } },
    { label: 'Цей місяць', apply: () => { setFrom(localDateStr(new Date(n.getFullYear(), n.getMonth(), 1))); setTo(localDateStr(new Date(n.getFullYear(), n.getMonth() + 1, 0))); } },
    { label: 'Минулий місяць', apply: () => { setFrom(localDateStr(new Date(n.getFullYear(), n.getMonth() - 1, 1))); setTo(localDateStr(new Date(n.getFullYear(), n.getMonth(), 0))); } },
    { label: 'Цей рік', apply: () => { setFrom(`${n.getFullYear()}-01-01`); setTo(`${n.getFullYear()}-12-31`); } },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {shortcuts.map(s => (
        <button key={s.label} onClick={s.apply}
          className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${colors}`}>
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ─── RegistryTab ──────────────────────────────────────────────────────────────
function RegistryTab() {
  const { user } = useAuthStore();
  const isInspector = user?.role === 'INSPECTOR';
  const now = new Date();
  const [from, setFrom] = useState(localDateStr(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(localDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const [formFilter, setFormFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);

  // Реєстр накладних = реєстр ЗАМОВЛЕНЬ (продажів), не накладних постачальника
  const { data, isLoading } = useQuery({
    queryKey: ['orders-registry', from, to, formFilter, isInspector],
    queryFn: () => api.get('/orders/reports/registry', {
      params: { from, to, ...(!isInspector && formFilter && { form: formFilter }) },
    }).then(r => r.data),
    enabled: !!(from && to),
  });

  const handlePrint = async () => {
    setPrintLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      const effectiveForm = isInspector ? 'FORM_1' : formFilter;
      if (effectiveForm) params.append('form', effectiveForm);
      const r = await api.get(`/documents/reports/registry?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch { alert('Помилка генерації'); }
    finally { setPrintLoading(false); }
  };

  const rows: any[] = data?.rows ?? [];

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <ShortcutBar setFrom={setFrom} setTo={setTo} accent="blue" />
          {!isInspector && (
            <button onClick={() => setShowFilters(v => !v)}
              className="text-xs text-blue-600 border border-blue-200 px-3 py-1.5 rounded-full hover:bg-blue-100 font-medium shrink-0">
              {showFilters ? '▲ Фільтри' : '▼ Фільтри'}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-xl border border-blue-200 px-3 py-2">
            <div className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide mb-1">Від</div>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full text-sm text-gray-800 focus:outline-none bg-transparent" />
          </div>
          <div className="bg-white rounded-xl border border-blue-200 px-3 py-2">
            <div className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide mb-1">До</div>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full text-sm text-gray-800 focus:outline-none bg-transparent" />
          </div>
        </div>
        {showFilters && !isInspector && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-xl border border-blue-200 px-3 py-2 col-span-2 sm:col-span-1">
              <div className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide mb-1">Форма</div>
              <select value={formFilter} onChange={e => setFormFilter(e.target.value)} className="w-full text-sm text-gray-800 focus:outline-none bg-transparent">
                <option value="">Всі форми</option>
                <option value="FORM_1">Ф1 (безнал)</option>
                <option value="FORM_2">Ф2 (готівка)</option>
              </select>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <div className="text-sm text-blue-700 font-medium">
            {rows.length > 0 && <span>{rows.length} накладних</span>}
            {data?.grandWithVat > 0 && <span className="ml-2 font-bold">{Number(data.grandWithVat).toFixed(2)} ₴</span>}
          </div>
          <button onClick={handlePrint} disabled={!from || !to || printLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:opacity-40 font-semibold shadow-sm">
            🖨️ {printLoading ? 'Завантаження...' : 'Реєстр PDF'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-400 py-12">Завантаження...</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed border-gray-200 rounded-xl">
          <div className="text-3xl mb-2">📋</div>
          <div className="text-sm">Накладних не знайдено за обраний період</div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-4 py-3 font-semibold">Дата</th>
                  <th className="px-4 py-3 font-semibold">№ накл.</th>
                  <th className="px-4 py-3 font-semibold">Клієнт</th>
                  <th className="px-4 py-3 font-semibold">Форма</th>
                  <th className="px-4 py-3 font-semibold text-right">Без ПДВ</th>
                  <th className="px-4 py-3 font-semibold text-right">ПДВ</th>
                  <th className="px-4 py-3 font-semibold text-right">З ПДВ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 text-gray-600 text-xs">{new Date(row.invoiceDate).toLocaleDateString('uk-UA')}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">№{row.number}{row.numberSuffix ?? ''}</td>
                    <td className="px-4 py-3 text-gray-700">{row.client}</td>
                    <td className="px-4 py-3"><FormBadge form={row.form} /></td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">{Number(row.totalNoVat).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-orange-500 text-xs">{Number(row.vat).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-bold text-blue-600">{Number(row.totalWithVat).toFixed(2)} ₴</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-bold text-sm">
                <tr>
                  <td className="px-4 py-3 text-gray-700" colSpan={4}>Всього</td>
                  <td className="px-4 py-3 text-right text-gray-600">{Number(data.grandNoVat).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-orange-600">{Number(data.grandVat).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-blue-700">{Number(data.grandWithVat).toFixed(2)} ₴</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SupplierCreateModal ──────────────────────────────────────────────────────
function SupplierCreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(localDateStr(new Date()));
  const [warehouseId, setWarehouseId] = useState('');
  const [invForm, setInvForm] = useState<'FORM_1' | 'FORM_2'>('FORM_1');
  const [note, setNote] = useState('');
  const [items, setItems] = useState([{ productId: '', quantity: '', pricePerKg: '', comment: '' }]);

  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/warehouses/suppliers').then(r => r.data) });
  const { data: warehouses = [] } = useQuery({ queryKey: ['warehouses'], queryFn: () => api.get('/warehouses').then(r => r.data) });
  const { data: products = [] } = useQuery({ queryKey: ['products-active'], queryFn: () => api.get('/products/active').then(r => r.data) });

  const inWarehouses = (warehouses as any[]).filter((w: any) => w.isActive && (w.type === 'FRIDGE' || w.type === 'SUPPLIES'));
  const addItem = () => setItems(prev => [...prev, { productId: '', quantity: '', pricePerKg: '', comment: '' }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, key: string, val: string) => setItems(prev => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));

  const validItems = items.filter(i => i.productId && Number(i.quantity) > 0 && Number(i.pricePerKg) > 0);
  const totalWithVat = validItems.reduce((s, i) => s + r2(Number(i.quantity) * Number(i.pricePerKg)), 0);
  const totalNoVat = Number((totalWithVat / 1.2).toFixed(2));
  const totalVat = Number((totalWithVat - totalNoVat).toFixed(2));

  const handleSave = async () => {
    if (!supplierId) return setError('Оберіть постачальника');
    if (!warehouseId) return setError('Оберіть склад');
    if (!invoiceDate) return setError('Вкажіть дату');
    if (validItems.length === 0) return setError('Додайте хоча б один товар');
    setLoading(true); setError('');
    try {
      await api.post('/supplier-invoices', {
        supplierId, invoiceNumber: invoiceNumber || undefined, invoiceDate,
        warehouseId, form: invForm, note: note || undefined,
        items: validItems.map(i => ({ productId: i.productId, quantity: Number(i.quantity), pricePerKg: Number(i.pricePerKg), comment: i.comment || undefined })),
      });
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices-list'] });
      onSaved(); onClose();
    } catch (e: any) { setError(e.response?.data?.message || 'Помилка збереження'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b shrink-0 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600">
          <div>
            <h2 className="font-bold text-white text-lg">➕ Нова накладна постачальника</h2>
            <p className="text-emerald-100 text-xs mt-0.5">Прихід товару на склад</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Постачальник *</label>
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">Оберіть...</option>
                {(suppliers as any[]).filter((s: any) => s.isActive).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Склад *</label>
              <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">Оберіть...</option>
                {inWarehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">№ накладної</label>
              <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Дата *</label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Форма</label>
              <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                {(['FORM_1', 'FORM_2'] as const).map(f => (
                  <button key={f} onClick={() => setInvForm(f)}
                    className={`flex-1 py-2.5 text-xs font-medium transition-colors ${invForm === f ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    {f === 'FORM_1' ? '🏦 Ф1' : '💵 Ф2'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Примітка</label>
            <input value={note} onChange={e => setNote(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Товари</label>
              <button onClick={addItem} className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold">+ Додати</button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => {
                const lineTotal = Number(item.quantity) > 0 && Number(item.pricePerKg) > 0 ? r2(Number(item.quantity) * Number(item.pricePerKg)) : 0;
                return (
                  <div key={idx} className="rounded-xl border border-gray-200 p-2.5 space-y-2 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <select value={item.productId} onChange={e => updateItem(idx, 'productId', e.target.value)}
                        className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                        <option value="">Продукт...</option>
                        {(products as any[]).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <input type="number" step="0.001" min="0" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)}
                        onWheel={e => e.currentTarget.blur()} placeholder="кг"
                        className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                      <input type="number" step="0.01" min="0" value={item.pricePerKg} onChange={e => updateItem(idx, 'pricePerKg', e.target.value)}
                        onWheel={e => e.currentTarget.blur()} placeholder="₴/кг"
                        className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                      <span className="w-20 text-right text-xs font-bold text-emerald-600 shrink-0">{lineTotal > 0 ? `${lineTotal.toFixed(2)}₴` : ''}</span>
                      {items.length > 1 && <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-lg leading-none px-1">×</button>}
                    </div>
                    <input type="text" value={item.comment} onChange={e => updateItem(idx, 'comment', e.target.value)}
                      placeholder="Коментар (необов'язково)"
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white" />
                  </div>
                );
              })}
            </div>
            {totalWithVat > 0 && (
              <div className="grid grid-cols-3 gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 mt-2">
                <div className="text-center"><div className="text-[10px] text-gray-400 mb-0.5">Без ПДВ</div><div className="text-sm font-bold text-gray-700">{totalNoVat.toFixed(2)} ₴</div></div>
                <div className="text-center"><div className="text-[10px] text-gray-400 mb-0.5">ПДВ 20%</div><div className="text-sm font-bold text-orange-500">{totalVat.toFixed(2)} ₴</div></div>
                <div className="text-center"><div className="text-[10px] text-gray-400 mb-0.5">З ПДВ</div><div className="text-sm font-bold text-emerald-600">{totalWithVat.toFixed(2)} ₴</div></div>
              </div>
            )}
          </div>
          {error && <div className="text-red-500 text-sm bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">⚠️ {error}</div>}
        </div>
        <div className="px-5 pb-5 pt-4 border-t flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50">Закрити</button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 bg-emerald-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-50 font-bold">
            {loading ? 'Зберігаю...' : 'Створити накладну'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SupplierInvoiceEditModal ─────────────────────────────────────────────────
function SupplierInvoiceEditModal({ invoiceId, onClose, onSaved }: {
  invoiceId: string; onClose: () => void; onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [itemsLocked, setItemsLocked] = useState(false);

  const { data: inv, isLoading } = useQuery({
    queryKey: ['supplier-invoice', invoiceId],
    queryFn: () => api.get(`/supplier-invoices/${invoiceId}`).then(r => r.data),
  });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/warehouses/suppliers').then(r => r.data) });
  const { data: warehouses = [] } = useQuery({ queryKey: ['warehouses'], queryFn: () => api.get('/warehouses').then(r => r.data) });
  const { data: products = [] } = useQuery({ queryKey: ['products-active'], queryFn: () => api.get('/products/active').then(r => r.data) });

  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [invForm, setInvForm] = useState<'FORM_1' | 'FORM_2'>('FORM_1');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<{ productId: string; quantity: string; pricePerKg: string; comment: string }[]>([]);
  const [initialized, setInitialized] = useState(false);

  if (inv && !initialized) {
    setSupplierId(inv.supplierId);
    setInvoiceNumber(inv.invoiceNumber || '');
    setInvoiceDate(new Date(inv.invoiceDate).toISOString().slice(0, 10));
    setWarehouseId(inv.warehouseId);
    setInvForm(inv.form);
    setNote(inv.note || '');
    setItems(inv.items.map((i: any) => ({
      productId: i.productId,
      quantity: String(Number(i.quantity)),
      pricePerKg: String(Number(i.pricePerKg)),
      comment: i.comment || '',
    })));
    setInitialized(true);
  }

  const inWarehouses = (warehouses as any[]).filter((w: any) => w.isActive && (w.type === 'FRIDGE' || w.type === 'SUPPLIES'));
  const addItem = () => setItems(prev => [...prev, { productId: '', quantity: '', pricePerKg: '', comment: '' }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, key: string, val: string) =>
    setItems(prev => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));

  const validItems = items.filter(i => i.productId && Number(i.quantity) > 0 && Number(i.pricePerKg) > 0);
  const totalWithVat = validItems.reduce((s, i) => s + r2(Number(i.quantity) * Number(i.pricePerKg)), 0);
  const totalNoVat = Number((totalWithVat / 1.2).toFixed(2));
  const totalVat = Number((totalWithVat - totalNoVat).toFixed(2));

  const handleSave = async () => {
    if (!supplierId) return setError('Оберіть постачальника');
    if (!warehouseId) return setError('Оберіть склад');
    setLoading(true); setError('');
    try {
      await api.patch(`/supplier-invoices/${invoiceId}`, {
        supplierId, invoiceNumber: invoiceNumber || undefined, invoiceDate,
        warehouseId, form: invForm, note: note || undefined,
        ...(!itemsLocked && validItems.length > 0 && {
          items: validItems.map(i => ({
            productId: i.productId,
            quantity: Number(i.quantity),
            pricePerKg: Number(i.pricePerKg),
            comment: i.comment || undefined,
          })),
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices-list'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-invoice', invoiceId] });
      onSaved(); onClose();
    } catch (e: any) {
      const msg = e.response?.data?.message || '';
      if (e.response?.status === 409 || msg.includes('вже були використані')) {
        setItemsLocked(true);
        setError('⚠️ Позиції заблоковані: товари вже використано. Можна редагувати лише заголовок накладної.');
      } else {
        setError(msg || 'Помилка збереження');
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b shrink-0 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600">
          <div>
            <h2 className="font-bold text-white text-lg">✏️ Редагування накладної постачальника</h2>
            {inv && <p className="text-emerald-100 text-xs mt-0.5">{inv.invoiceNumber ? `№${inv.invoiceNumber} · ` : ''}{inv.supplier?.name}</p>}
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">Завантаження...</div>
        ) : (
          <div className="overflow-y-auto flex-1 p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Постачальник *</label>
                <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="">Оберіть...</option>
                  {(suppliers as any[]).filter((s: any) => s.isActive).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Склад *</label>
                <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="">Оберіть...</option>
                  {inWarehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">№ накладної</label>
                <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Дата *</label>
                <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Форма</label>
                <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
                  {(['FORM_1', 'FORM_2'] as const).map(f => (
                    <button key={f} onClick={() => setInvForm(f)}
                      className={`flex-1 py-2.5 transition-colors text-xs font-medium ${invForm === f ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                      {f === 'FORM_1' ? '🏦 Ф1' : '💵 Ф2'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Примітка</label>
              <input value={note} onChange={e => setNote(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Товари {itemsLocked && <span className="text-amber-500 ml-1">🔒 заблоковано</span>}
                </label>
                {!itemsLocked && <button onClick={addItem} className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold">+ Додати</button>}
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => {
                  const lineTotal = Number(item.quantity) > 0 && Number(item.pricePerKg) > 0
                    ? r2(Number(item.quantity) * Number(item.pricePerKg)) : 0;
                  const productName = (products as any[]).find((p: any) => p.id === item.productId)?.name || item.productId;
                  return (
                    <div key={idx} className={`rounded-xl border p-2.5 space-y-2 ${itemsLocked ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center gap-2">
                        {itemsLocked ? (
                          <span className="flex-1 text-sm font-medium text-gray-700">{productName}</span>
                        ) : (
                          <select value={item.productId} onChange={e => updateItem(idx, 'productId', e.target.value)}
                            className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                            <option value="">Продукт...</option>
                            {(products as any[]).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        )}
                        <input type="number" step="0.001" min="0" value={item.quantity} readOnly={itemsLocked}
                          onChange={e => updateItem(idx, 'quantity', e.target.value)}
                          onWheel={e => e.currentTarget.blur()}
                          placeholder="кг" className={`w-20 border rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500 ${itemsLocked ? 'bg-amber-50 border-amber-200' : 'border-gray-300 bg-white'}`} />
                        <input type="number" step="0.01" min="0" value={item.pricePerKg} readOnly={itemsLocked}
                          onChange={e => updateItem(idx, 'pricePerKg', e.target.value)}
                          onWheel={e => e.currentTarget.blur()}
                          placeholder="₴/кг" className={`w-24 border rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500 ${itemsLocked ? 'bg-amber-50 border-amber-200' : 'border-gray-300 bg-white'}`} />
                        <span className="w-20 text-right text-xs font-bold text-emerald-600 shrink-0">{lineTotal > 0 ? `${lineTotal.toFixed(2)}₴` : ''}</span>
                        {!itemsLocked && items.length > 1 && (
                          <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-lg leading-none px-1">×</button>
                        )}
                      </div>
                      <input type="text" value={item.comment} readOnly={itemsLocked}
                        onChange={e => updateItem(idx, 'comment', e.target.value)}
                        placeholder="Коментар (необов'язково)"
                        className={`w-full border rounded-lg px-2 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${itemsLocked ? 'bg-amber-50 border-amber-200' : 'border-gray-200 bg-white'}`} />
                    </div>
                  );
                })}
              </div>
              {totalWithVat > 0 && (
                <div className="grid grid-cols-3 gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 mt-2">
                  <div className="text-center">
                    <div className="text-[10px] text-gray-400 mb-0.5">Без ПДВ</div>
                    <div className="text-sm font-bold text-gray-700">{totalNoVat.toFixed(2)} ₴</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-gray-400 mb-0.5">ПДВ 20%</div>
                    <div className="text-sm font-bold text-orange-500">{totalVat.toFixed(2)} ₴</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-gray-400 mb-0.5">З ПДВ</div>
                    <div className="text-sm font-bold text-emerald-600">{totalWithVat.toFixed(2)} ₴</div>
                  </div>
                </div>
              )}
            </div>

            {error && <div className="text-red-500 text-sm bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">⚠️ {error}</div>}
          </div>
        )}

        <div className="px-5 pb-5 pt-4 border-t flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50">Закрити</button>
          <button onClick={handleSave} disabled={loading || isLoading}
            className="flex-1 bg-emerald-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-50 font-bold">
            {loading ? 'Зберігаю...' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SuppliersTab ─────────────────────────────────────────────────────────────
function SuppliersTab() {
  const now = new Date();
  const [from, setFrom] = useState(localDateStr(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(localDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const [supplierId, setSupplierId] = useState('');
  const [formFilter, setFormFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showMgmt, setShowMgmt] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/warehouses/suppliers').then(r => r.data),
  });

  const handleDeleteInvoice = async (id: string, invoiceNumber: string | null) => {
    const label = invoiceNumber ? `№${invoiceNumber}` : 'цю накладну';
    if (!window.confirm(`Видалити ${label}? Товари будуть знято зі складу. Це незворотно.`)) return;
    setDeletingId(id);
    try {
      await api.delete(`/supplier-invoices/${id}`);
      refetch();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Помилка видалення');
    } finally { setDeletingId(null); }
  };

  const { data: invoices = [], isLoading, refetch } = useQuery({
    queryKey: ['supplier-invoices-list', from, to, supplierId, formFilter],
    queryFn: () => api.get('/supplier-invoices', { params: { ...(from && { from }), ...(to && { to }), ...(supplierId && { supplierId }), ...(formFilter && { form: formFilter }) } }).then(r => r.data),
  });

  const handlePrint = async () => {
    if (!from || !to) return;
    setPrintLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (supplierId) params.append('supplierId', supplierId);
      if (formFilter) params.append('form', formFilter);
      const r = await api.get(`/documents/reports/supplier-registry?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch { alert('Помилка генерації'); }
    finally { setPrintLoading(false); }
  };

  const grandTotal = (invoices as any[]).reduce((s: number, inv: any) => s + Number(inv.totalWithVat || 0), 0);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <ShortcutBar setFrom={setFrom} setTo={setTo} accent="emerald" />
          <button onClick={() => setShowFilters(v => !v)}
            className="text-xs text-emerald-600 border border-emerald-200 px-3 py-1.5 rounded-full hover:bg-emerald-100 font-medium shrink-0">
            {showFilters ? '▲ Фільтри' : '▼ Фільтри'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-xl border border-emerald-200 px-3 py-2">
            <div className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide mb-1">Від</div>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full text-sm text-gray-800 focus:outline-none bg-transparent" />
          </div>
          <div className="bg-white rounded-xl border border-emerald-200 px-3 py-2">
            <div className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide mb-1">До</div>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full text-sm text-gray-800 focus:outline-none bg-transparent" />
          </div>
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-xl border border-emerald-200 px-3 py-2">
              <div className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide mb-1">Постачальник</div>
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full text-sm text-gray-800 focus:outline-none bg-transparent">
                <option value="">Всі</option>
                {(suppliers as any[]).filter((s: any) => s.isActive).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="bg-white rounded-xl border border-emerald-200 px-3 py-2">
              <div className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide mb-1">Форма</div>
              <select value={formFilter} onChange={e => setFormFilter(e.target.value)} className="w-full text-sm text-gray-800 focus:outline-none bg-transparent">
                <option value="">Всі форми</option>
                <option value="FORM_1">Ф1 (безнал)</option>
                <option value="FORM_2">Ф2 (готівка)</option>
              </select>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <div className="text-sm text-emerald-700 font-medium">
            {(invoices as any[]).length} накладних
            {grandTotal > 0 && <span className="ml-2 text-base font-bold">{r2(grandTotal).toFixed(2)} ₴</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowMgmt(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 font-medium">
              🏭 Постачальники
            </button>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-emerald-300 text-emerald-700 text-sm rounded-xl hover:bg-emerald-50 font-semibold">
              ➕ Нова накладна
            </button>
            <button onClick={handlePrint} disabled={!from || !to || printLoading}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-xl hover:bg-emerald-700 disabled:opacity-40 font-semibold shadow-sm">
              🖨️ {printLoading ? 'Завантаження...' : 'Реєстр PDF'}
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-400 py-12">Завантаження...</div>
      ) : (invoices as any[]).length === 0 ? (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed border-gray-200 rounded-xl">
          <div className="text-3xl mb-2">📭</div>
          <div className="text-sm">Накладних не знайдено</div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-4 py-3 font-semibold">Дата</th>
                  <th className="px-4 py-3 font-semibold">№ накл.</th>
                  <th className="px-4 py-3 font-semibold">Постачальник</th>
                  <th className="px-4 py-3 font-semibold">Форма</th>
                  <th className="px-4 py-3 font-semibold text-right">Без ПДВ</th>
                  <th className="px-4 py-3 font-semibold text-right">З ПДВ</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(invoices as any[]).map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-emerald-50/50 transition-colors group">
                    <td className="px-4 py-3 text-gray-600 text-xs cursor-pointer" onClick={() => setEditingId(inv.id)}>{new Date(inv.invoiceDate).toLocaleDateString('uk-UA')}</td>
                    <td className="px-4 py-3 font-medium text-gray-800 cursor-pointer" onClick={() => setEditingId(inv.id)}>{inv.invoiceNumber || '—'}</td>
                    <td className="px-4 py-3 text-gray-700 font-medium cursor-pointer" onClick={() => setEditingId(inv.id)}>{inv.supplier?.name}</td>
                    <td className="px-4 py-3 cursor-pointer" onClick={() => setEditingId(inv.id)}><FormBadge form={inv.form} /></td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs cursor-pointer" onClick={() => setEditingId(inv.id)}>{Number(inv.totalNoVat).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600 cursor-pointer" onClick={() => setEditingId(inv.id)}>{Number(inv.totalWithVat).toFixed(2)} ₴</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteInvoice(inv.id, inv.invoiceNumber)}
                        disabled={deletingId === inv.id}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded-lg hover:bg-red-50 transition-all disabled:opacity-40">
                        {deletingId === inv.id ? '...' : '🗑'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sm:hidden divide-y divide-gray-100">
            {(invoices as any[]).map((inv: any) => (
              <div key={inv.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 cursor-pointer" onClick={() => setEditingId(inv.id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800">{inv.supplier?.name}</span>
                      <FormBadge form={inv.form} />
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {new Date(inv.invoiceDate).toLocaleDateString('uk-UA')}
                      {inv.invoiceNumber ? ` · №${inv.invoiceNumber}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-emerald-600 text-sm">{Number(inv.totalWithVat).toFixed(2)} ₴</span>
                    <button
                      onClick={() => handleDeleteInvoice(inv.id, inv.invoiceNumber)}
                      disabled={deletingId === inv.id}
                      className="text-red-400 hover:text-red-600 text-sm px-2 py-1 rounded-lg hover:bg-red-50 disabled:opacity-40">
                      {deletingId === inv.id ? '...' : '🗑'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editingId && <SupplierInvoiceEditModal invoiceId={editingId} onClose={() => setEditingId(null)} onSaved={() => { setEditingId(null); refetch(); }} />}
      {showCreate && <SupplierCreateModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); refetch(); }} />}
      {showMgmt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b shrink-0 flex items-center justify-between">
              <h2 className="font-bold text-gray-800 text-lg">🏭 Постачальники</h2>
              <button onClick={() => setShowMgmt(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              <SupplierMgmtTab />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SupplierMgmtTab ──────────────────────────────────────────────────────────
const SUPPLIER_TYPE_COLOR: Record<string, string> = {
  FISH: 'bg-cyan-100 text-cyan-700',
  SERVICES: 'bg-orange-100 text-orange-700',
  SUPPLIES: 'bg-purple-100 text-purple-700',
};
const SUPPLIER_TYPE_LABEL: Record<string, string> = {
  FISH: '🐟 Рибна продукція',
  SERVICES: '🔧 Послуги',
  SUPPLIES: '🧴 Матеріали',
};

function SupplierMgmtTab() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [supplierType, setSupplierType] = useState('');
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/warehouses/suppliers').then(r => r.data) });

  const handleCreate = async () => {
    if (!name.trim()) return setError('Вкажіть назву');
    setSaving(true); setError('');
    try {
      await api.post('/warehouses/suppliers', { name: name.trim(), type: supplierType || undefined });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setName(''); setSupplierType(''); setShowCreate(false);
    } catch (e: any) { setError(e.response?.data?.message || 'Помилка'); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(true); setError('');
    try {
      await api.patch(`/warehouses/suppliers/${id}`, { name: editName.trim(), type: editType || undefined });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setEditId(null);
    } catch (e: any) { setError(e.response?.data?.message || 'Помилка'); }
    finally { setSaving(false); }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await api.patch(`/warehouses/suppliers/${id}`, { isActive: !isActive });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    } catch { alert('Помилка'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800 text-lg">🏭 Постачальники</h3>
        <button onClick={() => setShowCreate(v => !v)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 font-semibold">
          ➕ Додати
        </button>
      </div>

      {showCreate && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="text-sm font-semibold text-blue-800">Новий постачальник</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Назва постачальника"
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <select value={supplierType} onChange={e => setSupplierType(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Тип (необов'язково)</option>
              <option value="FISH">🐟 Рибна продукція</option>
              <option value="SERVICES">🔧 Послуги</option>
              <option value="SUPPLIES">🧴 Допоміжні матеріали</option>
            </select>
          </div>
          {error && <div className="text-red-500 text-xs">{error}</div>}
          <div className="flex gap-2">
            <button onClick={() => { setShowCreate(false); setName(''); setSupplierType(''); setError(''); }}
              className="flex-1 border border-gray-200 text-gray-600 text-sm px-3 py-2 rounded-xl hover:bg-gray-50">Скасувати</button>
            <button onClick={handleCreate} disabled={saving}
              className="flex-1 bg-blue-600 text-white text-sm px-3 py-2 rounded-xl hover:bg-blue-700 font-bold disabled:opacity-50">
              {saving ? 'Зберігаю...' : 'Зберегти'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
        {(suppliers as any[]).length === 0 ? (
          <div className="text-center text-gray-400 py-10 text-sm">Постачальників немає</div>
        ) : (suppliers as any[]).map((s: any) => (
          <div key={s.id} className="p-4">
            {editId === s.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <select value={editType} onChange={e => setEditType(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Тип (необов'язково)</option>
                    <option value="FISH">🐟 Рибна продукція</option>
                    <option value="SERVICES">🔧 Послуги</option>
                    <option value="SUPPLIES">🧴 Допоміжні матеріали</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditId(null)} className="flex-1 text-xs border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-50">Скасувати</button>
                  <button onClick={() => handleUpdate(s.id)} disabled={saving}
                    className="flex-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50">Зберегти</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-medium text-gray-800 text-sm ${!s.isActive ? 'line-through text-gray-400' : ''}`}>{s.name}</span>
                  {s.type && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${SUPPLIER_TYPE_COLOR[s.type] || 'bg-gray-100 text-gray-500'}`}>
                      {SUPPLIER_TYPE_LABEL[s.type] || s.type}
                    </span>
                  )}
                  {!s.isActive && <span className="text-[10px] text-red-400 font-semibold">неактивний</span>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => { setEditId(s.id); setEditName(s.name); setEditType(s.type || ''); }}
                    className="text-xs border border-gray-200 text-gray-500 px-2.5 py-1.5 rounded-lg hover:bg-gray-50">✏️</button>
                  <button onClick={() => handleToggle(s.id, s.isActive)}
                    className={`text-xs border px-2.5 py-1.5 rounded-lg ${s.isActive ? 'border-red-200 text-red-500 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                    {s.isActive ? 'Деакт.' : 'Акт.'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AdjustmentModal ──────────────────────────────────────────────────────────
function AdjustmentModal({ supplierId, supplierName, onClose, onSaved }: {
  supplierId: string; supplierName: string; onClose: () => void; onSaved: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [paymentDate, setPaymentDate] = useState(localDateStr(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const amtNum = parseFloat(amount.replace(',', '.'));
    if (!amount || isNaN(amtNum)) return setError('Вкажіть суму');
    if (!paymentDate) return setError('Вкажіть дату');
    setLoading(true); setError('');
    try {
      await api.post('/supplier-invoices/payments', { supplierId, amount: amtNum, note: note || undefined, paymentDate });
      onSaved(); onClose();
    } catch (e: any) { setError(e.response?.data?.message || 'Помилка'); }
    finally { setLoading(false); }
  };

  const amtNum = parseFloat(amount.replace(',', '.'));
  const isPayment = !isNaN(amtNum) && amtNum < 0;
  const isCharge = !isNaN(amtNum) && amtNum > 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800">Виплата / Коригування</h3>
            <p className="text-xs text-gray-400 mt-0.5">{supplierName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Сума <span className="normal-case font-normal">(від'ємна = виплата, додатня = нарахування)</span>
            </label>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
              onWheel={e => e.currentTarget.blur()} placeholder="напр. -5000 або +1200"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {isPayment && <div className="text-xs text-green-600 mt-1">✅ Виплата постачальнику — зменшить борг</div>}
            {isCharge && <div className="text-xs text-orange-600 mt-1">⚠️ Нарахування — збільшить борг</div>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Дата</label>
            <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Примітка</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="необов'язково"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {error && <div className="text-red-500 text-xs bg-red-50 border border-red-100 px-3 py-2 rounded-xl">⚠️ {error}</div>}
        </div>
        <div className="px-5 pb-5 flex gap-2">
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

// ─── SupplierSettlementCard ───────────────────────────────────────────────────
const SUP_TYPE_ICON: Record<string, string> = { FISH: '🐟', SERVICES: '🔧', SUPPLIES: '🧴' };
const SUP_TYPE_LABEL_MAP: Record<string, string> = { FISH: 'Рибна продукція', SERVICES: 'Надавач послуг', SUPPLIES: 'Допоміжні матеріали' };
const SUP_TYPE_ACCENT: Record<string, { border: string; text: string; light: string }> = {
  FISH:     { border: 'border-cyan-200',   text: 'text-cyan-700',   light: 'bg-cyan-50' },
  SERVICES: { border: 'border-orange-200', text: 'text-orange-700', light: 'bg-orange-50' },
  SUPPLIES: { border: 'border-purple-200', text: 'text-purple-700', light: 'bg-purple-50' },
};
const DEFAULT_ACCENT = { border: 'border-slate-200', text: 'text-slate-700', light: 'bg-slate-50' };

function SupplierSettlementCard({ row, onAddAdjustment, onDeletePayment }: {
  row: any; onAddAdjustment: (id: string, name: string) => void; onDeletePayment: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const acc = SUP_TYPE_ACCENT[row.supplier.type] || DEFAULT_ACCENT;
  const isOverdue = row.balance > 0;

  return (
    <div className={`rounded-2xl border-2 overflow-hidden ${acc.border}`}>
      <div className={`px-4 py-3 ${acc.light} flex items-center justify-between gap-3 cursor-pointer select-none`}
        onClick={() => setExpanded(v => !v)}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">{SUP_TYPE_ICON[row.supplier.type] || '🏭'}</span>
          <div className="min-w-0">
            <div className="font-bold text-gray-800 truncate">{row.supplier.name}</div>
            {row.supplier.type && <div className={`text-[10px] font-semibold ${acc.text}`}>{SUP_TYPE_LABEL_MAP[row.supplier.type]}</div>}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className={`text-xs font-semibold ${isOverdue ? 'text-red-500' : 'text-green-600'}`}>
              {isOverdue ? '⚠️ Борг' : '✅ Переплата'}
            </div>
            <div className={`text-lg font-black ${isOverdue ? 'text-red-600' : 'text-green-600'}`}>
              {Math.abs(row.balance).toFixed(2)} ₴
            </div>
          </div>
          <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="bg-white px-4 pb-4 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className={`rounded-xl ${acc.light} border ${acc.border} p-3`}>
              <div className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${acc.text}`}>Надходжень за період</div>
              <div className="text-base font-bold text-gray-800">{row.periodInvoiced.toFixed(2)} ₴</div>
            </div>
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide mb-0.5 text-blue-600">Виплати / коригування</div>
              <div className={`text-base font-bold ${row.periodAdjusted < 0 ? 'text-green-600' : row.periodAdjusted > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                {row.periodAdjusted !== 0 ? `${row.periodAdjusted > 0 ? '+' : ''}${row.periodAdjusted.toFixed(2)} ₴` : '—'}
              </div>
            </div>
          </div>

          {row.events.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Хронологія за період</div>
              <div className="space-y-1.5">
                {row.events.map((ev: any) => (
                  <div key={ev.id} className={`flex items-start justify-between gap-2 rounded-xl px-3 py-2 text-sm ${
                    ev.type === 'invoice' ? `${acc.light} border ${acc.border}` : 'bg-blue-50 border border-blue-100'
                  }`}>
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="mt-0.5 shrink-0">{ev.type === 'invoice' ? '📄' : ev.amount < 0 ? '💸' : '➕'}</span>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-800 text-xs">
                          {ev.type === 'invoice'
                            ? `Накладна${ev.invoiceNumber ? ` №${ev.invoiceNumber}` : ''}`
                            : ev.note || (ev.amount < 0 ? 'Виплата' : 'Нарахування')}
                        </div>
                        <div className="text-[10px] text-gray-400">{new Date(ev.date).toLocaleDateString('uk-UA')}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className={`text-sm font-bold ${ev.type === 'invoice' ? acc.text : ev.amount < 0 ? 'text-green-600' : 'text-orange-600'}`}>
                        {ev.type === 'payment' && (ev.amount < 0 ? '−' : '+')}
                        {Math.abs(ev.amount).toFixed(2)} ₴
                      </div>
                      {ev.type === 'payment' && (
                        <button onClick={() => onDeletePayment(ev.id)} className="text-red-300 hover:text-red-500 text-xs px-1 leading-none">×</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => onAddAdjustment(row.supplier.id, row.supplier.name)}
            className={`w-full text-sm font-semibold py-2.5 rounded-xl border-2 border-dashed ${acc.border} ${acc.text} hover:opacity-80 transition-opacity`}>
            ➕ Додати виплату / коригування
          </button>
        </div>
      )}
    </div>
  );
}

// ─── ClientAdjustmentModal ────────────────────────────────────────────────────
function ClientAdjustmentModal({ clientId: initialClientId, clientName: initialClientName, onClose, onSaved }: {
  clientId?: string; clientName?: string; onClose: () => void; onSaved: () => void;
}) {
  const [selectedClientId, setSelectedClientId] = useState(initialClientId ?? '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [paymentDate, setPaymentDate] = useState(localDateStr(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const needPicker = !initialClientId;

  const { data: allClients = [] } = useQuery<any[]>({
    queryKey: ['clients-list'],
    queryFn: () => api.get('/clients').then(r => r.data),
    enabled: needPicker,
  });

  const resolvedName = initialClientName
    ?? (allClients as any[]).find((c: any) => c.id === selectedClientId)?.name
    ?? '';

  const handleSave = async () => {
    if (needPicker && !selectedClientId) return setError('Виберіть клієнта');
    const amtNum = parseFloat(amount.replace(',', '.'));
    if (!amount || isNaN(amtNum)) return setError('Вкажіть суму');
    if (!paymentDate) return setError('Вкажіть дату');
    setLoading(true); setError('');
    try {
      await api.post('/orders/client-payments', {
        clientId: selectedClientId || initialClientId,
        amount: amtNum, note: note || undefined, paymentDate,
      });
      onSaved(); onClose();
    } catch (e: any) { setError(e.response?.data?.message || 'Помилка'); }
    finally { setLoading(false); }
  };

  const amtNum = parseFloat(amount.replace(',', '.'));
  const isPayment = !isNaN(amtNum) && amtNum < 0;
  const isCharge = !isNaN(amtNum) && amtNum > 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800">Оплата / Коригування</h3>
            {resolvedName && <p className="text-xs text-gray-400 mt-0.5">{resolvedName}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          {needPicker && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Клієнт</label>
              <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">— Виберіть клієнта —</option>
                {(allClients as any[]).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Сума <span className="normal-case font-normal">(від'ємна = оплата від клієнта, додатня = нарахування)</span>
            </label>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
              onWheel={e => e.currentTarget.blur()} placeholder="напр. -5000 або +1200"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {isPayment && <div className="text-xs text-green-600 mt-1">✅ Оплата від клієнта — зменшить борг</div>}
            {isCharge && <div className="text-xs text-orange-600 mt-1">⚠️ Нарахування — збільшить борг клієнта</div>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Дата</label>
            <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Примітка</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="необов'язково"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {error && <div className="text-red-500 text-xs bg-red-50 border border-red-100 px-3 py-2 rounded-xl">⚠️ {error}</div>}
        </div>
        <div className="px-5 pb-5 flex gap-2">
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

// ─── ClientSettlementCard ─────────────────────────────────────────────────────
function ClientSettlementCard({ row, onAddAdjustment, onDeletePayment }: {
  row: any; onAddAdjustment: (id: string, name: string) => void; onDeletePayment: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isDebt = row.balance > 0;

  return (
    <div className={`rounded-2xl border-2 overflow-hidden ${isDebt ? 'border-red-200' : 'border-emerald-200'}`}>
      <div className={`px-4 py-3 flex items-center justify-between gap-3 cursor-pointer select-none ${isDebt ? 'bg-red-50' : 'bg-emerald-50'}`}
        onClick={() => setExpanded(v => !v)}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">👤</span>
          <div className="font-bold text-gray-800 truncate">{row.client.name}</div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className={`text-xs font-semibold ${isDebt ? 'text-red-500' : 'text-emerald-600'}`}>
              {isDebt ? '⚠️ Борг' : '✅ Переплата'}
            </div>
            <div className={`text-lg font-black ${isDebt ? 'text-red-600' : 'text-emerald-600'}`}>
              {Math.abs(row.balance).toFixed(2)} ₴
            </div>
          </div>
          <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="bg-white px-4 pb-4 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className={`rounded-xl p-3 ${isDebt ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
              <div className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${isDebt ? 'text-red-600' : 'text-emerald-600'}`}>Нараховано за період</div>
              <div className="text-base font-bold text-gray-800">{row.periodInvoiced.toFixed(2)} ₴</div>
            </div>
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide mb-0.5 text-blue-600">Оплати / коригування</div>
              <div className={`text-base font-bold ${row.periodAdjusted < 0 ? 'text-emerald-600' : row.periodAdjusted > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                {row.periodAdjusted !== 0 ? `${row.periodAdjusted > 0 ? '+' : ''}${row.periodAdjusted.toFixed(2)} ₴` : '—'}
              </div>
            </div>
          </div>

          {row.events.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Хронологія за період</div>
              <div className="space-y-1.5">
                {row.events.map((ev: any) => (
                  <div key={ev.id} className={`flex items-start justify-between gap-2 rounded-xl px-3 py-2 text-sm ${
                    ev.type === 'order' ? `${isDebt ? 'bg-red-50 border border-red-100' : 'bg-emerald-50 border border-emerald-100'}` : 'bg-blue-50 border border-blue-100'
                  }`}>
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="mt-0.5 shrink-0">{ev.type === 'order' ? '📄' : ev.amount < 0 ? '💸' : '➕'}</span>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-800 text-xs">
                          {ev.type === 'order'
                            ? `Накладна${ev.orderNumber ? ` №${ev.orderNumber}` : ''}`
                            : ev.note || (ev.amount < 0 ? 'Оплата' : 'Нарахування')}
                        </div>
                        <div className="text-[10px] text-gray-400">{new Date(ev.date).toLocaleDateString('uk-UA')}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className={`text-sm font-bold ${
                        ev.type === 'order' ? (isDebt ? 'text-red-600' : 'text-emerald-600') : ev.amount < 0 ? 'text-emerald-600' : 'text-orange-600'
                      }`}>
                        {ev.type === 'payment' && (ev.amount < 0 ? '−' : '+')}
                        {Math.abs(ev.amount).toFixed(2)} ₴
                      </div>
                      {ev.type === 'payment' && (
                        <button onClick={() => onDeletePayment(ev.id)} className="text-red-300 hover:text-red-500 text-xs px-1 leading-none">×</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => onAddAdjustment(row.client.id, row.client.name)}
            className="w-full text-sm font-semibold py-2.5 rounded-xl border-2 border-dashed border-blue-200 text-blue-600 hover:opacity-80 transition-opacity">
            ➕ Додати оплату / коригування
          </button>
        </div>
      )}
    </div>
  );
}

// ─── SettlementTab ────────────────────────────────────────────────────────────
function SettlementTab() {
  const now = new Date();
  const [from, setFrom] = useState(localDateStr(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(localDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const [subTab, setSubTab] = useState<'suppliers' | 'clients'>('suppliers');
  const [adjustTarget, setAdjustTarget] = useState<{ id: string; name: string } | null>(null);
  const [clientAdjustTarget, setClientAdjustTarget] = useState<{ id: string; name: string } | null>(null);
  const [showNewPayment, setShowNewPayment] = useState(false);
  const queryClient = useQueryClient();

  // ── Постачальники ──
  const { data: supRows = [], isLoading: supLoading, refetch: supRefetch } = useQuery({
    queryKey: ['settlements', from, to],
    queryFn: () => api.get('/supplier-invoices/settlements', { params: { from, to } }).then(r => r.data),
    enabled: !!(from && to),
  });

  const handleDeleteSupPayment = async (id: string) => {
    if (!window.confirm('Видалити цей запис?')) return;
    try {
      await api.delete(`/supplier-invoices/payments/${id}`);
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
      supRefetch();
    } catch { alert('Помилка видалення'); }
  };

  // ── Клієнти ──
  const { data: cliRows = [], isLoading: cliLoading, isError: cliError, refetch: cliRefetch } = useQuery({
    queryKey: ['client-settlements', from, to],
    queryFn: () => api.get('/orders/reports/client-settlements', { params: { from, to } }).then(r => r.data),
    enabled: !!(from && to),
    retry: 1,
  });

  const handleDeleteCliPayment = async (id: string) => {
    if (!window.confirm('Видалити цей запис?')) return;
    try {
      await api.delete(`/orders/client-payments/${id}`);
      queryClient.invalidateQueries({ queryKey: ['client-settlements'] });
      cliRefetch();
    } catch { alert('Помилка видалення'); }
  };

  const activeRows = subTab === 'suppliers' ? (supRows as any[]) : (cliRows as any[]);
  const isLoading = subTab === 'suppliers' ? supLoading : cliLoading;
  const totalDebt = activeRows.reduce((s: number, r: any) => s + (r.balance > 0 ? r.balance : 0), 0);
  const totalOverpaid = activeRows.reduce((s: number, r: any) => s + (r.balance < 0 ? Math.abs(r.balance) : 0), 0);

  return (
    <div className="space-y-4">
      {/* Шапка з датами */}
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full">🏦 Лише Форма 1 (безнал)</span>
          {/* Під-вкладки */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs bg-white">
            <button onClick={() => setSubTab('suppliers')}
              className={`px-3 py-1.5 font-semibold transition-colors ${subTab === 'suppliers' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              🏭 Постачальники
            </button>
            <button onClick={() => setSubTab('clients')}
              className={`px-3 py-1.5 font-semibold transition-colors ${subTab === 'clients' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              👥 Клієнти
            </button>
          </div>
        </div>
        <ShortcutBar setFrom={setFrom} setTo={setTo} accent="blue" />
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2">
            <div className="text-[10px] text-slate-600 font-semibold uppercase tracking-wide mb-1">Від</div>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full text-sm text-gray-800 focus:outline-none bg-transparent" />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2">
            <div className="text-[10px] text-slate-600 font-semibold uppercase tracking-wide mb-1">До</div>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full text-sm text-gray-800 focus:outline-none bg-transparent" />
          </div>
        </div>
      </div>

      {/* Підсумки */}
      {activeRows.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
            <div className="text-xs text-red-500 font-semibold uppercase tracking-wide mb-0.5">
              {subTab === 'suppliers' ? 'Борг постачальникам' : 'Борг клієнтів'}
            </div>
            <div className="text-xl font-black text-red-600">{totalDebt.toFixed(2)} ₴</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <div className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-0.5">Переплата</div>
            <div className="text-xl font-black text-green-600">{totalOverpaid.toFixed(2)} ₴</div>
          </div>
        </div>
      )}

      {/* Список */}
      {subTab === 'clients' && (
        <button onClick={() => setShowNewPayment(true)}
          className="w-full text-sm font-semibold py-2.5 rounded-xl border-2 border-dashed border-blue-200 text-blue-600 hover:opacity-80 transition-opacity">
          ➕ Нова оплата / коригування
        </button>
      )}

      {isLoading ? (
        <div className="text-center text-gray-400 py-12">Завантаження...</div>
      ) : subTab === 'clients' && cliError ? (
        <div className="text-center text-red-400 py-12 border-2 border-dashed border-red-200 rounded-xl">
          <div className="text-3xl mb-2">⚠️</div>
          <div className="text-sm font-semibold">Помилка завантаження</div>
          <div className="text-xs mt-1 text-red-400">Можливо, міграція БД не виконана.<br/>Запустіть: <code className="bg-red-50 px-1 rounded">npx prisma migrate deploy</code></div>
        </div>
      ) : activeRows.length === 0 ? (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed border-gray-200 rounded-xl">
          <div className="text-3xl mb-2">{subTab === 'suppliers' ? '🏭' : '👥'}</div>
          <div className="text-sm">Немає даних за обраний період</div>
        </div>
      ) : subTab === 'suppliers' ? (
        <div className="space-y-3">
          {(supRows as any[]).map((row: any) => (
            <SupplierSettlementCard
              key={row.supplier.id}
              row={row}
              onAddAdjustment={(id, name) => setAdjustTarget({ id, name })}
              onDeletePayment={handleDeleteSupPayment}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {(cliRows as any[]).map((row: any) => (
            <ClientSettlementCard
              key={row.client.id}
              row={row}
              onAddAdjustment={(id, name) => setClientAdjustTarget({ id, name })}
              onDeletePayment={handleDeleteCliPayment}
            />
          ))}
        </div>
      )}

      {adjustTarget && (
        <AdjustmentModal
          supplierId={adjustTarget.id}
          supplierName={adjustTarget.name}
          onClose={() => setAdjustTarget(null)}
          onSaved={() => { setAdjustTarget(null); supRefetch(); queryClient.invalidateQueries({ queryKey: ['settlements'] }); }}
        />
      )}
      {clientAdjustTarget && (
        <ClientAdjustmentModal
          clientId={clientAdjustTarget.id}
          clientName={clientAdjustTarget.name}
          onClose={() => setClientAdjustTarget(null)}
          onSaved={() => { setClientAdjustTarget(null); cliRefetch(); queryClient.invalidateQueries({ queryKey: ['client-settlements'] }); }}
        />
      )}
      {showNewPayment && (
        <ClientAdjustmentModal
          onClose={() => setShowNewPayment(false)}
          onSaved={() => { setShowNewPayment(false); cliRefetch(); queryClient.invalidateQueries({ queryKey: ['client-settlements'] }); }}
        />
      )}
    </div>
  );
}

// ─── BudgetTab ────────────────────────────────────────────────────────────────
function BudgetTab() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [from, setFrom] = useState(firstDay);
  const [to, setTo] = useState(lastDay);

  const { data, isLoading } = useQuery({
    queryKey: ['budget', from, to],
    queryFn: () => api.get('/supplier-invoices/budget', { params: { from, to, form: 'FORM_1' } }).then(r => r.data),
    enabled: !!(from && to),
  });

  const totalSales: number = data?.totalSales ?? 0;
  const totalPurchases: number = data?.totalPurchases ?? 0;
  const balance: number = data?.balance ?? 0;
  const purchaseRatio = totalSales > 0 ? (totalPurchases / totalSales) * 100 : 0;
  const barWidth = Math.min(100, purchaseRatio);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">🏦 Форма 1 (безнал)</span>
          <span className="text-xs text-blue-500">Бюджет завжди розраховується лише по Ф1</span>
        </div>
        <ShortcutBar setFrom={setFrom} setTo={setTo} accent="blue" />
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-xl border border-blue-200 px-3 py-2">
            <div className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide mb-1">Від</div>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="w-full text-sm text-gray-800 focus:outline-none bg-transparent" />
          </div>
          <div className="bg-white rounded-xl border border-blue-200 px-3 py-2">
            <div className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide mb-1">До</div>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="w-full text-sm text-gray-800 focus:outline-none bg-transparent" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-400 py-12">Завантаження...</div>
      ) : !data ? (
        <div className="text-center text-gray-400 py-12">Оберіть період</div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-1">📤 Продажі (з ПДВ)</div>
              <div className="text-2xl font-bold text-green-700">{totalSales.toFixed(2)} ₴</div>
              <div className="text-xs text-green-500 mt-0.5">виконані заявки за період</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="text-xs text-orange-600 font-semibold uppercase tracking-wide mb-1">📥 Закупівлі (з ПДВ)</div>
              <div className="text-2xl font-bold text-orange-700">{totalPurchases.toFixed(2)} ₴</div>
              <div className="text-xs text-orange-500 mt-0.5">накладні постачальників за період</div>
            </div>
            <div className={`border rounded-xl p-4 ${balance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
              <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                💰 Баланс
              </div>
              <div className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                {balance >= 0 ? '+' : ''}{balance.toFixed(2)} ₴
              </div>
              <div className={`text-xs mt-0.5 ${balance >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                {balance >= 0 ? 'прибуток за мінусом закупівлі для ПДВ' : 'закупівля перевищує продажі для ПДВ'}
              </div>
            </div>
          </div>

          {totalSales > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Частка закупівлі від продажів</span>
                <span className="text-sm font-bold text-gray-800">{purchaseRatio.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all ${purchaseRatio > 100 ? 'bg-red-500' : purchaseRatio > 90 ? 'bg-orange-400' : 'bg-emerald-500'}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-gray-400">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── EditArchiveOrderModal ────────────────────────────────────────────────────
function EditArchiveOrderModal({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const extEdit = order as Order & { numberForm?: number; numberSuffix?: string; deliveryPointId?: string; invoiceDate?: string; plannedDate?: string };
  const displayNumber = String(extEdit.numberForm ?? order.number) + (extEdit.numberSuffix ?? '');

  const [clientId, setClientId] = useState(order.clientId);
  const [orderNumRaw, setOrderNumRaw] = useState(
    String(extEdit.numberForm ?? '') + (extEdit.numberSuffix ?? ''),
  );
  const [driverName, setDriverName] = useState(order.driverName || '');
  const [carNumber, setCarNumber] = useState(order.carNumber || '');
  const [deliveryPointId, setDeliveryPointId] = useState(extEdit.deliveryPointId || '');
  const [note, setNote] = useState(order.note || '');
  const [invoiceDate, setInvoiceDate] = useState(
    extEdit.invoiceDate ? new Date(extEdit.invoiceDate).toISOString().slice(0, 10) : '',
  );
  const [plannedDate, setPlannedDate] = useState(
    extEdit.plannedDate ? new Date(extEdit.plannedDate).toISOString().slice(0, 10) : '',
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
        numberForm: parseOrderNum(orderNumRaw).num,
        numberSuffix: parseOrderNum(orderNumRaw).suffix || undefined,
        driverName: driverName || undefined,
        carNumber: carNumber || undefined,
        deliveryPointId: deliveryPointId || undefined,
        note: note || undefined,
        plannedDate: plannedDate || undefined,
        invoiceDate: invoiceDate || undefined,
      });
      // Зберігаємо фактичні ваги окремо
      const weightItems = items
        .filter((i) => i.actualWeight !== '' || i.pricePerKg > 0)
        .map((i) => ({
          itemId: i.id,
          ...(i.actualWeight !== '' && { actualWeight: Number(i.actualWeight) }),
          pricePerKg: i.pricePerKg,
        }));
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
            <input
              value={orderNumRaw}
              onChange={(e) => setOrderNumRaw(e.target.value)}
              placeholder="напр. 8 або 8/"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {parseOrderNum(orderNumRaw).suffix && (
              <p className="text-[10px] text-gray-400 mt-1">
                Буде: №{parseOrderNum(orderNumRaw).num}{parseOrderNum(orderNumRaw).suffix}
              </p>
            )}
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Позиції</label>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.id} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50">
                  <div className="text-xs font-semibold text-gray-700 mb-2">{item.productName}</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="text-[10px] text-gray-400 mb-0.5">Планова</div>
                      <input type="number" step="0.001" min="0" value={item.plannedWeight}
                        onChange={(e) => setItems((prev) => prev.map((p, i) => i === idx ? { ...p, plannedWeight: e.target.value } : p))}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                    </div>
                    <div className="text-gray-300 mt-4">→</div>
                    <div className="flex-1">
                      <div className="text-[10px] text-gray-400 mb-0.5">Фактична</div>
                      <input type="number" step="0.001" min="0" value={item.actualWeight}
                        onChange={(e) => setItems((prev) => prev.map((p, i) => i === idx ? { ...p, actualWeight: e.target.value } : p))}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                    <div className="text-xs text-gray-400 mt-4">{item.productUnit}</div>
                    <div className="flex-1">
                      <div className="text-[10px] text-gray-400 mb-0.5">Ціна/кг ₴</div>
                      <input type="number" step="0.01" min="0" value={item.pricePerKg || ''}
                        onChange={(e) => setItems((prev) => prev.map((p, i) => i === idx ? { ...p, pricePerKg: Number(e.target.value) } : p))}
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder="0.00"
                        className="w-full border border-amber-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50/50" />
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
  const [activeTab, setActiveTab] = useState<'orders' | 'registry' | 'suppliers' | 'settlement' | 'budget'>('orders');
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
    { id: 'orders',     label: '📋 Накладні',              labelMobile: '📋' },
    { id: 'registry',   label: '🖨️ Реєстр накладних',      labelMobile: '🖨️ Реєстр' },
    { id: 'suppliers',  label: '💰 Реєстр постачальників',  labelMobile: '💰 Постач.' },
    { id: 'settlement', label: '💼 Розрахунок',             labelMobile: '💼' },
    { id: 'budget',     label: '📊 Бюджет',                 labelMobile: '📊' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Бухгалтерія</h1>
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

      {/* Вкладки — мобільний горизонтальний скрол */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm w-max min-w-full sm:w-fit bg-white">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 sm:px-4 py-2.5 font-medium transition-colors whitespace-nowrap text-xs sm:text-sm ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              <span className="sm:hidden">{tab.labelMobile}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
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
                  const orderTotal = calcOrderTotal(order.items);
                  const orderWeight = order.items.reduce((s, i) => s + Number(i.actualWeight ?? i.plannedWeight), 0);
                  const extOrder = order as Order & { printedAt?: string; numberForm?: number; numberSuffix?: string; deliveryPoint?: { name: string } };
                  const isPrinted = !!extOrder.printedAt;
                  const displayNumber = String(extOrder.numberForm ?? order.number) + (extOrder.numberSuffix ?? '');
                  return (
                    <div key={order.id} onClick={() => setSelectedOrder(order)}
                      className="p-4 active:bg-blue-50/50 cursor-pointer">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-gray-800">№{displayNumber}</span>
                          {isPrinted && <span className="text-purple-400 text-xs font-bold">✓</span>}
                          <FormBadge form={order.form} />
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_COLOR[order.status]}`}>
                            {STATUS_LABEL[order.status]}
                          </span>
                        </div>
                        <span className="font-bold text-green-600 text-sm shrink-0">{(addVat(orderTotal)).toFixed(2)} ₴</span>
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
                      const extOrd = order as Order & { printedAt?: string; numberForm?: number; numberSuffix?: string; deliveryPoint?: { name: string } };
                      const orderTotal = calcOrderTotal(order.items);
                      const orderWeight = order.items.reduce((s, i) => s + Number(i.actualWeight ?? i.plannedWeight), 0);
                      const isPrinted = !!extOrd.printedAt;
                      const displayNumber = String(extOrd.numberForm ?? order.number) + (extOrd.numberSuffix ?? '');
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
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_COLOR[order.status]}`}>
                              {STATUS_LABEL[order.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600 text-xs font-medium">{orderWeight.toFixed(1)} кг</td>
                          <td className="px-4 py-3 text-right"><span className="font-bold text-green-600">{(addVat(orderTotal)).toFixed(2)} ₴</span></td>
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
      {activeTab === 'settlement' && <SettlementTab />}
      {activeTab === 'budget' && <BudgetTab />}

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
