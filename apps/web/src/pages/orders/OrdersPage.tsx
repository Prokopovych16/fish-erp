import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { useAuthStore } from '@/store/auth';
import { Order, OrderStatus, Form } from '@/types';
import { r2, addVat, parseOrderNum } from '@/utils/finance';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';

// ─── FormBadge ────────────────────────────────────────────────────────────────
function FormBadge({ form }: { form: Form }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide ${
      form === 'FORM_1' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
    }`}>
      {form === 'FORM_1' ? 'Ф1' : 'Ф2'}
    </span>
  );
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Чернетка', PENDING: 'Очікує', IN_PROGRESS: 'В роботі',
  DONE: 'Виконано', CANCELLED: 'Скасовано',
};
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  PENDING: 'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  DONE: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

// Які переходи дозволені при drag
const ALLOWED_DRAG: Record<string, OrderStatus[]> = {
  DRAFT:       ['PENDING'],
  PENDING:     ['DRAFT', 'IN_PROGRESS'],
  IN_PROGRESS: ['PENDING', 'DONE'],
  DONE:        ['IN_PROGRESS'],
};

function DeliveryPointBadge({ point }: { point: { name: string; address?: string | null } }) {
  return (
    <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5">
      <span>📍</span>
      <span className="font-semibold text-gray-700">{point.name}</span>
      {point.address && <span className="text-gray-400">— {point.address}</span>}
    </div>
  );
}

// ─── ShortageModal ────────────────────────────────────────────────────────────
function ShortageModal({ data, onClose, onTransferred, userRole }: {
  data: { orderId: string; shortages: { productName: string; needed: number; available: number }[]; warehouseId: string };
  onClose: () => void; onTransferred: () => void; userRole: string;
}) {
  const queryClient = useQueryClient();
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: allStock = [] } = useQuery({
    queryKey: ['stock'],
    queryFn: () => api.get('/warehouses/stock/all').then((r) => r.data),
  });

  const availableWarehouses = allStock.filter((w: any) => w.isActive && w.id !== data.warehouseId);
  const selectedWarehouseStock = fromWarehouseId ? allStock.find((w: any) => w.id === fromWarehouseId) : null;

  const getStockForProduct = (productName: string) => {
    if (!selectedWarehouseStock) return null;
    return (selectedWarehouseStock.stockItems || [])
      .filter((i: any) => i.product.name === productName && Number(i.quantity) > 0)
      .reduce((s: number, i: any) => s + Number(i.quantity), 0);
  };

  const handleTransfer = async () => {
    if (!fromWarehouseId) return setError('Оберіть склад');
    setLoading(true); setError('');
    try {
      const fromWarehouse = allStock.find((w: any) => w.id === fromWarehouseId);
      for (const shortage of data.shortages) {
        const needed = shortage.needed - shortage.available;
        if (needed <= 0) continue;
        const stockItems = (fromWarehouse?.stockItems || []).filter(
          (i: any) => i.product.name === shortage.productName && Number(i.quantity) > 0,
        );
        if (!stockItems.length) { setError(`Товар "${shortage.productName}" не знайдено`); setLoading(false); return; }
        const total = stockItems.reduce((s: number, i: any) => s + Number(i.quantity), 0);
        if (total < needed) { setError(`Недостатньо "${shortage.productName}"`); setLoading(false); return; }
        await api.post('/warehouses/movement', {
          type: 'TRANSFER', warehouseId: fromWarehouseId, toWarehouseId: data.warehouseId,
          productId: stockItems[0].productId, quantity: needed,
          note: 'Переміщено для виконання заявки', form: stockItems[0].form ?? 'FORM_1',
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['stock'] });
      await queryClient.refetchQueries({ queryKey: ['stock'] });
      onTransferred();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Помилка');
    } finally { setLoading(false); }
  };

  if (userRole === 'WORKER') {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="bg-orange-50 border-b border-orange-100 p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-xl">⚠️</div>
            <div><h2 className="font-bold text-gray-800">Недостатньо товару</h2><p className="text-xs text-gray-500 mt-0.5">Зверніться до адміністратора</p></div>
          </div>
          <div className="p-5 space-y-2">
            {data.shortages.map((s, idx) => (
              <div key={idx} className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
                <div className="text-sm font-semibold text-gray-800">{s.productName}</div>
                <div className="text-xs text-red-500 mt-1">Не вистачає: <b>{(s.needed - s.available).toFixed(3)} кг</b></div>
              </div>
            ))}
          </div>
          <div className="px-5 pb-5"><button onClick={onClose} className="w-full border border-gray-200 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50">Зрозуміло</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-orange-50 border-b border-orange-100 p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-xl">⚠️</div>
          <div><h2 className="font-bold text-gray-800">Недостатньо товару</h2><p className="text-xs text-gray-500 mt-0.5">Оберіть склад для переміщення</p></div>
        </div>
        <div className="p-5 space-y-4">
          {data.shortages.map((s, idx) => {
            const onSel = getStockForProduct(s.productName);
            const deficit = s.needed - s.available;
            const ok = onSel !== null && onSel >= deficit;
            return (
              <div key={idx} className={`rounded-xl border p-3.5 ${fromWarehouseId ? ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-gray-800 text-sm">{s.productName}</span>
                  {fromWarehouseId && onSel !== null && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{ok ? '✓' : '✕'}</span>}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[{ l: 'Треба', v: `${s.needed.toFixed(3)} кг` }, { l: 'Є', v: `${s.available.toFixed(3)} кг` }, { l: 'Дефіцит', v: `${deficit.toFixed(3)} кг` }].map((c) => (
                    <div key={c.l} className="text-center bg-white/70 rounded-lg p-2"><div className="text-gray-400 mb-0.5">{c.l}</div><div className="font-bold text-gray-800">{c.v}</div></div>
                  ))}
                </div>
              </div>
            );
          })}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">З якого складу?</label>
            <select value={fromWarehouseId} onChange={(e) => { setFromWarehouseId(e.target.value); setError(''); }}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">Оберіть...</option>
              {availableWarehouses
                .map((w: any) => {
                  const relevantQty = (w.stockItems || [])
                    .filter((i: any) => 
                      Number(i.quantity) > 0 &&
                      data.shortages.some(s => s.productName === i.product?.name)
                    )
                    .reduce((s: number, i: any) => s + Number(i.quantity), 0);
                  const totalQty = (w.stockItems || [])
                    .filter((i: any) => Number(i.quantity) > 0)
                    .reduce((s: number, i: any) => s + Number(i.quantity), 0);
                  return { w, relevantQty, totalQty };
                })
                .filter(({ totalQty }) => totalQty > 0)
                .sort((a, b) => b.relevantQty - a.relevantQty)
                .map(({ w, relevantQty, totalQty }) => (
                  <option key={w.id} value={w.id}>
                    {w.name} · всього: {totalQty.toFixed(1)} кг
                    {relevantQty > 0 ? ` · потрібного: ${relevantQty.toFixed(1)} кг` : ''}
                  </option>
                ))
              }
            </select>
          </div>
          {error && <div className="text-red-500 text-sm bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">⚠️ {error}</div>}
        </div>
        <div className="px-5 pb-5 flex gap-2 border-t pt-4">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50">Скасувати</button>
          <button onClick={handleTransfer} disabled={loading || !fromWarehouseId}
            className="flex-1 bg-orange-500 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-orange-600 disabled:opacity-50 font-bold">
            {loading ? 'Переміщую...' : '→ Перемістити і завершити'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── OrderDetailsModal ────────────────────────────────────────────────────────
function OrderDetailsModal({ order, onClose, onStatusChange, onUpdateWeights, onOpenBazaarReturn, onEdit, onDelete, userRole }: {
  order: Order; onClose: () => void;
  onStatusChange: (id: string, status: OrderStatus) => void;
  onUpdateWeights: (order: Order) => void;
  onOpenBazaarReturn?: (order: Order) => void;
  onEdit?: () => void;
  onDelete?: (id: string) => void;
  userRole: string;
}) {
  const queryClient = useQueryClient();
  const [printed, setPrinted] = useState(!!(order as any).printedAt);
  const displayNumber = (order as any).numberForm ?? order.number;
  const deliveryPoint = (order as any).deliveryPoint;
  const isBazaar = !!(order as any).isBazaar;
  const total = order.items.reduce((s, i) => {
    if (i.product.unit === 'шт' && !i.actualWeight) return s;
    return s + r2(Number(i.actualWeight ?? i.plannedWeight) * Number(i.pricePerKg ?? 0));
  }, 0);
  const totalPlanned = order.items.reduce((s, i) => s + Number(i.plannedWeight), 0);
  const totalActual = order.items.reduce((s, i) => s + Number(i.actualWeight ?? i.plannedWeight), 0);
  const [returnWeights, setReturnWeights] = useState<Record<string, string>>({});
  const [processingReturn, setProcessingReturn] = useState<string | null>(null);

  const deliveryPointId = (order as any).deliveryPointId;

  const { data: orderReturns = [] } = useQuery({
    queryKey: ['order-returns-by-point', deliveryPointId],
    queryFn: () => api.get(`/client-returns/pending-by-point/${deliveryPointId}`).then(r => r.data),
    enabled: !!deliveryPointId,
  });

  const handleProcessReturn = async (retId: string) => {
    setProcessingReturn(retId);
    try {
      const ret = (orderReturns as any[]).find((r: any) => r.id === retId);
      if (!ret) return;
      await api.patch(`/client-returns/${retId}/process`, {
        orderId: order.id,
        items: ret.items.map((item: any) => ({
          returnItemId: item.id,
          actualQty: Number(returnWeights[item.id] || item.goodQty),
        })),
      });
      queryClient.invalidateQueries({ queryKey: ['order-returns-by-point', deliveryPointId] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['client-returns'] });
    } catch (e: any) {
      alert(e.response?.data?.message || 'Помилка');
    } finally {
      setProcessingReturn(null);
    }
  };

  const handlePrint = async (type: 'ttn' | 'quality' | 'invoice' | 'bazaar-issuance' | 'bazaar-settlement') => {
    try {
      const r = await api.get(`/documents/order/${order.id}/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      if (!printed) { try { await api.patch(`/orders/${order.id}/printed`); setPrinted(true); queryClient.invalidateQueries({ queryKey: ['orders'] }); } catch {} }
    } catch { alert('Помилка генерації'); }
  };
  const handlePrintAll = async () => {
    try {
      const r = await api.get(`/documents/order/${order.id}/all`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      if (!printed) { try { await api.patch(`/orders/${order.id}/printed`); setPrinted(true); queryClient.invalidateQueries({ queryKey: ['orders'] }); } catch {} }
    } catch { alert('Помилка генерації'); }
  };

  const totalWithVat = addVat(total);

  const buttons = (
    <>
      {order.status === 'DRAFT' && userRole === 'ADMIN' && (
        <button onClick={() => { onStatusChange(order.id, 'PENDING'); onClose(); }}
          className="w-full bg-slate-600 text-white text-sm px-3 py-2.5 rounded-xl hover:bg-slate-700 font-semibold">
          → В Очікує
        </button>
      )}
      {order.status === 'PENDING' && isBazaar && (
        <>
          <button onClick={() => handlePrint('bazaar-issuance')}
            className="w-full bg-orange-50 text-orange-700 border border-orange-200 text-sm px-3 py-2.5 rounded-xl hover:bg-orange-100 font-semibold">
            📄 Накладна на видачу + декларація
          </button>
          {onOpenBazaarReturn && (
            <button onClick={() => { onOpenBazaarReturn(order); onClose(); }}
              className="w-full bg-orange-600 text-white text-sm px-3 py-2.5 rounded-xl hover:bg-orange-700 font-semibold">
              📦 Оформити повернення і розрахунок
            </button>
          )}
        </>
      )}
      {order.status === 'PENDING' && !isBazaar && (
        <button onClick={() => { onStatusChange(order.id, 'IN_PROGRESS'); onClose(); }}
          className="w-full bg-blue-600 text-white text-sm px-3 py-2.5 rounded-xl hover:bg-blue-700 font-semibold">
          ▶ Взяти в роботу
        </button>
      )}
      {order.status === 'IN_PROGRESS' && (
        <>
          <button onClick={() => { onUpdateWeights(order); onClose(); }}
            className="w-full bg-yellow-500 text-white text-sm px-3 py-2.5 rounded-xl hover:bg-yellow-600 font-semibold">
            ✏️ Вписати вагу
          </button>
          <button onClick={() => { onStatusChange(order.id, 'DONE'); onClose(); }}
            className="w-full bg-green-600 text-white text-sm px-3 py-2.5 rounded-xl hover:bg-green-700 font-semibold">
            ✓ Готово
          </button>
        </>
      )}
      {order.status === 'DONE' && userRole === 'ADMIN' && isBazaar && (
        <>
          <button onClick={() => handlePrint('bazaar-settlement')}
            className="w-full bg-green-600 text-white text-sm px-3 py-2.5 rounded-xl hover:bg-green-700 font-bold">
            🧾 Розрахунок (видано/повернено/продано)
          </button>
          <button onClick={() => handlePrint('bazaar-issuance')}
            className="w-full bg-blue-600 text-white text-sm px-3 py-2.5 rounded-xl hover:bg-blue-700 font-semibold">
            📄 Накладна на видачу + декларація
          </button>
        </>
      )}
      {order.status === 'DONE' && userRole === 'ADMIN' && !isBazaar && (
        <>
          <button onClick={handlePrintAll}
            className="w-full bg-green-600 text-white text-sm px-3 py-2.5 rounded-xl hover:bg-green-700 font-bold">
            🖨️ Все (5 стор.)
          </button>
          {[{ type: 'invoice' as const, label: '📄 Накладна', cls: 'bg-blue-600 hover:bg-blue-700' },
            { type: 'ttn' as const, label: '🚚 ТТН', cls: 'bg-gray-600 hover:bg-gray-700' },
            { type: 'quality' as const, label: '✅ Якісне', cls: 'bg-gray-600 hover:bg-gray-700' }].map((btn) => (
            <button key={btn.type} onClick={() => handlePrint(btn.type)}
              className={`w-full ${btn.cls} text-white text-sm px-3 py-2.5 rounded-xl font-semibold`}>{btn.label}</button>
          ))}
        </>
      )}
      {userRole === 'ADMIN' && (
        <>
          {!isBazaar && (order.status === 'DONE' || order.status === 'IN_PROGRESS') && (
            <button onClick={() => { onUpdateWeights(order); onClose(); }}
              className="w-full border border-yellow-200 text-yellow-700 text-sm px-3 py-2.5 rounded-xl hover:bg-yellow-50 font-semibold">
              ⚖️ Редагувати вагу
            </button>
          )}
          {onEdit && (
            <button onClick={onEdit}
              className="w-full border border-blue-200 text-blue-700 text-sm px-3 py-2.5 rounded-xl hover:bg-blue-50 font-semibold">
              ✏️ Редагувати
            </button>
          )}
          {!isBazaar && order.status === 'PENDING' && (
            <button onClick={() => { onStatusChange(order.id, 'DRAFT'); onClose(); }}
              className="w-full border border-slate-200 text-slate-600 text-sm px-3 py-2.5 rounded-xl hover:bg-slate-50 font-semibold">
              ← В Чернетки
            </button>
          )}
          {!isBazaar && order.status === 'DONE' && (
            <button onClick={() => { onStatusChange(order.id, 'IN_PROGRESS'); onClose(); }}
              className="w-full border border-gray-200 text-gray-600 text-sm px-3 py-2.5 rounded-xl hover:bg-gray-50 font-semibold">
              ↩ Повернути
            </button>
          )}
        </>
      )}
      {userRole === 'ADMIN' && <div className="border-t border-gray-200 my-1" />}
      {!isBazaar && userRole === 'ADMIN' && ['PENDING', 'IN_PROGRESS'].includes(order.status) && (
        <button onClick={() => { onStatusChange(order.id, 'CANCELLED'); onClose(); }}
          className="w-full border border-red-200 text-red-500 text-sm px-3 py-2.5 rounded-xl hover:bg-red-50 font-semibold">
          ✕ Скасувати
        </button>
      )}
      {userRole === 'ADMIN' && onDelete && (
        <button onClick={() => onDelete(order.id)}
          className="w-full border border-red-300 text-red-600 text-sm px-3 py-2.5 rounded-xl hover:bg-red-50 font-semibold">
          🗑 Видалити
        </button>
      )}
      <button onClick={onClose} className="w-full border border-gray-200 text-gray-600 text-sm px-3 py-2.5 rounded-xl hover:bg-gray-50">
        Закрити
      </button>
    </>
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b flex items-start justify-between gap-2 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-gray-800 text-xl">№{displayNumber}</h2>
              <FormBadge form={order.form} />
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_COLOR[order.status]}`}>{STATUS_LABEL[order.status]}</span>
              {printed && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">✓ Роздруковано</span>}
            </div>
            <div className="text-sm text-gray-600 mt-0.5 font-medium">{order.client.name}</div>
            {deliveryPoint && <DeliveryPointBadge point={deliveryPoint} />}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none shrink-0">×</button>
        </div>

        {/* Body: two columns on desktop */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">

          {/* Left: order content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Meta info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                order.driverName && { icon: '🚗', label: 'Водій', value: order.driverName },
                order.carNumber && { icon: '🚛', label: 'Авто', value: order.carNumber },
                order.createdBy && { icon: '👤', label: 'Створив', value: order.createdBy.name },
                order.assignedTo && { icon: '⚙️', label: 'Виконує', value: order.assignedTo.name },
                { icon: '📅', label: 'Створено', value: new Date(order.createdAt).toLocaleDateString('uk-UA') },
                order.completedAt && { icon: '✅', label: 'Виконано', value: new Date(order.completedAt).toLocaleDateString('uk-UA') },
                (order as any).invoiceDate && { icon: '📄', label: 'Накладна', value: new Date((order as any).invoiceDate).toLocaleDateString('uk-UA') },
              ].filter(Boolean).map((item: any) => (
                <div key={item.label} className="bg-gray-50 border border-gray-100 rounded-xl p-2.5">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{item.label}</div>
                  <div className="text-sm font-semibold text-gray-700 truncate">{item.icon} {item.value}</div>
                </div>
              ))}
            </div>

            {/* Items table */}
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Позиції</div>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-xs text-gray-400">
                      <th className="px-3 py-2.5 font-semibold">Товар</th>
                      <th className="px-3 py-2.5 font-semibold text-right">План</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Факт</th>
                      {userRole !== 'WORKER' && <th className="px-3 py-2.5 font-semibold text-right">Ціна</th>}
                      {userRole !== 'WORKER' && <th className="px-3 py-2.5 font-semibold text-right">Сума</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {order.items.map((item) => {
                      const displayUnit = (item as any).displayUnit || item.product.unit;
                      const w = Number(item.actualWeight ?? item.plannedWeight);
                      const p = Number(item.pricePerKg ?? 0);
                      const canCalcPrice = item.product.unit !== 'шт' || !!item.actualWeight;
                      const lineTotal = canCalcPrice && w * p > 0 ? r2(w * p) * 1.2 : null;
                      return (
                        <tr key={item.id} className="hover:bg-gray-50/50">
                          <td className="px-3 py-2.5 font-semibold text-gray-800 text-xs">{item.product.name}</td>
                          <td className="px-3 py-2.5 text-right text-gray-400 text-xs">{Number(item.plannedWeight).toFixed(3)} {displayUnit}</td>
                          <td className="px-3 py-2.5 text-right text-xs font-semibold text-green-600">{item.actualWeight ? `${Number(item.actualWeight).toFixed(3)} ${displayUnit}` : '—'}</td>
                          {userRole !== 'WORKER' && <td className="px-3 py-2.5 text-right text-gray-500 text-xs">{canCalcPrice && p > 0 ? `${(p * 1.2).toFixed(2)} ₴` : '—'}</td>}
                          {userRole !== 'WORKER' && <td className="px-3 py-2.5 text-right font-bold text-gray-800 text-xs">{lineTotal != null ? `${lineTotal.toFixed(2)} ₴` : '—'}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr className="text-sm font-bold text-gray-700">
                      <td className="px-3 py-2.5 text-xs">Всього</td>
                      <td className="px-3 py-2.5 text-right text-gray-400 text-xs font-normal">{totalPlanned.toFixed(3)}</td>
                      <td className="px-3 py-2.5 text-right text-xs text-green-600">{totalActual.toFixed(3)}</td>
                      {userRole !== 'WORKER' && <td className="px-3 py-2.5 text-right text-xs">—</td>}
                      {userRole !== 'WORKER' && <td className="px-3 py-2.5 text-right text-green-600 font-bold">{total > 0 ? `${totalWithVat.toFixed(2)} ₴` : '—'}</td>}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {order.note && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <div className="text-xs font-bold text-amber-500 uppercase tracking-wide mb-0.5">Примітка</div>
                <div className="text-sm text-gray-700">{order.note}</div>
              </div>
            )}

            {/* Returns */}
            {(orderReturns as any[]).length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">↩ Повернення з цього магазину</div>
                {(orderReturns as any[]).map((ret: any) => (
                  <div key={ret.id} className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-orange-600">📅 {new Date(ret.createdAt).toLocaleDateString('uk-UA')}</span>
                      {ret.note && <span className="text-xs text-gray-400 italic">{ret.note}</span>}
                    </div>
                    <div className="space-y-2">
                      {ret.items.map((item: any) => (
                        <div key={item.id} className="bg-white border border-orange-100 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-gray-800">{item.product.name}</span>
                            <span className="text-xs text-gray-400">очікується: <b>{Number(item.goodQty).toFixed(3)} кг</b></span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number" step="0.001" min="0"
                              value={returnWeights[item.id] ?? ''}
                              onChange={(e) => setReturnWeights(prev => ({ ...prev, [item.id]: e.target.value }))}
                              placeholder={Number(item.goodQty).toFixed(3)}
                              style={{ MozAppearance: 'textfield' } as any}
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-orange-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                            <span className="text-xs text-gray-400 shrink-0">кг факт</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => handleProcessReturn(ret.id)} disabled={processingReturn === ret.id}
                      className="w-full bg-orange-500 text-white text-sm px-4 py-2 rounded-xl hover:bg-orange-600 disabled:opacity-50 font-semibold">
                      {processingReturn === ret.id ? 'Обробляю...' : '✓ Прийняти і списати зі складу'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="md:hidden pt-4 border-t space-y-2">
              {buttons}
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="hidden md:flex md:flex-col md:w-52 shrink-0 md:border-l border-gray-200 p-4 gap-2 bg-gray-50/50">
            {buttons}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── WeightsModal ─────────────────────────────────────────────────────────────
function WeightsModal({ order, onClose, onSave, userRole }: {
  order: Order; onClose: () => void;
  onSave: (items: { itemId: string; actualWeight: number }[]) => void;
  userRole: string;
}) {
  const queryClient = useQueryClient();

  // FIX 3: auto-save — зберігаємо при кожній зміні ваги
  const autoSaveMutation = useMutation({
    mutationFn: (items: { itemId: string; actualWeight: number }[]) =>
      api.patch(`/orders/${order.id}/items`, { items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const [weights, setWeights] = useState<Record<string, string>>(
    Object.fromEntries(order.items.map((i) => [i.id, i.actualWeight ? String(i.actualWeight) : ''])),
  );

  // Дебаунс автозбереження — 600мс після останньої зміни
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleWeightChange = useCallback((itemId: string, value: string) => {
    setWeights((prev) => {
      const next = { ...prev, [itemId]: value };

      // Скасовуємо попередній таймер
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

      // Запускаємо новий таймер автозбереження
      autoSaveTimer.current = setTimeout(() => {
        const itemsToSave = order.items
          .filter((i) => next[i.id] !== '')
          .map((i) => ({ itemId: i.id, actualWeight: Number(next[i.id]) }));
        if (itemsToSave.length > 0) {
          autoSaveMutation.mutate(itemsToSave);
        }
      }, 600);

      return next;
    });
  }, [order.items, autoSaveMutation]);

  const displayNumber = (order as any).numberForm ?? order.number;
  const totalPlanned = order.items.reduce((s, i) => s + Number(i.plannedWeight), 0);
  const totalActual = order.items.reduce((s, i) => s + (Number(weights[i.id]) || 0), 0);
  const totalSum = order.items.reduce((s, i) => {
    if (i.product.unit === 'шт' && !weights[i.id]) return s;
    return s + r2((Number(weights[i.id]) || 0) * Number(i.pricePerKg ?? 0));
  }, 0);

  const kgItems = order.items.filter(i => {
    const du = (i as any).displayUnit || 'кг';
    return du === 'кг';
  });
  const totalPlannedKg = kgItems.reduce((s, i) => s + Number(i.plannedWeight), 0);
  const totalActualKg = kgItems.reduce((s, i) => s + (Number(weights[i.id]) || 0), 0);
  const totalDiffKg = totalActualKg - totalPlannedKg;
  const totalDiffPctKg = totalPlannedKg > 0 ? (totalDiffKg / totalPlannedKg) * 100 : 0;

  // Статус автозбереження
  const isSaving = autoSaveMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-gray-800 text-lg">Фактична вага — №{displayNumber}</h2>
                <FormBadge form={order.form} />
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{order.client.name}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Індикатор автозбереження */}
              {isSaving && (
                <span className="text-xs text-gray-400 animate-pulse">💾 збереження...</span>
              )}
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
          </div>
        </div>
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {order.items.map((item) => {
            const displayUnit = (item as any).displayUnit || item.product.unit;
            const unitMode = item.product.unit === 'шт';
            const planned = Number(item.plannedWeight);
            const actual = Number(weights[item.id]) || 0;
            const diff = actual - planned;
            const diffPct = planned > 0 ? (diff / planned) * 100 : 0;
            const hasValue = weights[item.id] !== '';
            const price = Number(item.pricePerKg ?? 0);
            const cardColor = unitMode
              ? hasValue ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'
              : hasValue && actual > 0
                ? Math.abs(diffPct) <= 2 ? 'border-green-200 bg-green-50'
                : Math.abs(diffPct) <= 5 ? 'border-yellow-200 bg-yellow-50'
                : 'border-red-200 bg-red-50'
              : 'border-gray-200 bg-gray-50';
            return (
              <div key={item.id} className={`rounded-xl border p-4 transition-all ${cardColor}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-bold text-gray-800 text-sm">{item.product.name}</span>
                    {displayUnit !== 'кг' && (
                      <span className="ml-2 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-semibold">{displayUnit}</span>
                    )}
                  </div>
                  {price > 0 && hasValue && actual > 0 && userRole !== 'WORKER' && (
                    <span className="text-xs font-bold text-green-600">{(actual * price).toFixed(2)} ₴</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Планова</div>
                    <div className="bg-white/80 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 text-right font-medium">
                      {planned.toFixed(3)} {displayUnit}
                    </div>
                  </div>
                  <div className="text-gray-300 text-lg shrink-0 mt-4">→</div>
                  <div className="flex-1">
                    <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Фактична</div>
                    {/* FIX 2: прибираємо повзунок (spinner) */}
                    <input
                      type="number"
                      step={unitMode ? '1' : '0.001'}
                      min="0"
                      value={weights[item.id]}
                      onChange={(e) => handleWeightChange(item.id, e.target.value)}
                      style={{ MozAppearance: 'textfield' } as any}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                  <div className="text-xs text-gray-400 shrink-0 mt-5">{displayUnit}</div>
                </div>
                {!unitMode && hasValue && actual > 0 && (
                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/60">
                    <span className="text-xs text-gray-500">Відхилення:</span>
                    <span className={`text-xs font-bold ${Math.abs(diffPct) <= 2 ? 'text-green-600' : Math.abs(diffPct) <= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {diff > 0 ? '+' : ''}{diff.toFixed(3)} ({diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%)
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="px-5 pt-3 pb-2 shrink-0">
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'План', value: totalPlanned.toFixed(3), color: 'text-gray-700' },
              { label: 'Факт', value: totalActual.toFixed(3), color: totalActual > 0 ? 'text-blue-600' : 'text-gray-400' },
              {
                label: 'Відхилення',
                value: totalActualKg > 0 ? `${totalDiffKg > 0 ? '+' : ''}${totalDiffPctKg.toFixed(1)}%` : '—',
                color: totalActualKg === 0 ? 'text-gray-400' : Math.abs(totalDiffPctKg) <= 2 ? 'text-green-600' : Math.abs(totalDiffPctKg) <= 5 ? 'text-yellow-600' : 'text-red-600',
              },
            ].map((c) => (
              <div key={c.label}>
                <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">{c.label}</div>
                <div className={`font-bold text-sm ${c.color}`}>{c.value}</div>
              </div>
            ))}
          </div>
          {totalSum > 0 && userRole !== 'WORKER' && (
            <div className="mt-2 text-right text-sm"><span className="text-gray-500">Сума (з ПДВ): </span><span className="font-bold text-green-600">{addVat(totalSum).toFixed(2)} ₴</span></div>
          )}
        </div>
        <div className="px-5 pb-5 border-t pt-4 flex gap-2 shrink-0">
          <button onClick={() => {
            const planWeights = Object.fromEntries(order.items.map((i) => [i.id, String(i.plannedWeight)]));
            setWeights(planWeights);
            // Автозберігаємо план
            if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
            const itemsToSave = order.items.map((i) => ({ itemId: i.id, actualWeight: Number(i.plannedWeight) }));
            autoSaveMutation.mutate(itemsToSave);
          }}
            className="border border-gray-200 text-gray-600 text-sm px-3 py-2.5 rounded-xl hover:bg-gray-50 whitespace-nowrap font-medium">= План</button>
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50">Закрити</button>
          <button onClick={() => onSave(order.items.filter((i) => weights[i.id] !== '').map((i) => ({ itemId: i.id, actualWeight: Number(weights[i.id]) })))}
            className="flex-1 bg-blue-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-blue-700 font-bold">Зберегти</button>
        </div>
      </div>
    </div>
  );
}

// ─── CreateOrderModal ─────────────────────────────────────────────────────────
function CreateOrderModal({ onClose, onCreated, defaultBazaar }: { onClose: () => void; onCreated: () => void; defaultBazaar?: boolean }) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const isInspector = currentUser?.role === 'INSPECTOR';
  const [clientId, setClientId] = useState('');
  const [form, setForm] = useState<Form>(defaultBazaar ? 'FORM_2' : 'FORM_1');
  const [note, setNote] = useState('');
  const [driverName, setDriverName] = useState('');
  const [carNumber, setCarNumber] = useState('');
  const [deliveryPointId, setDeliveryPointId] = useState('');
  const [addingPoint, setAddingPoint] = useState(false);
  const [newPointName, setNewPointName] = useState('');
  const [savingPoint, setSavingPoint] = useState(false);
  const [items, setItems] = useState([{ productId: '', plannedWeight: '', displayUnit: 'кг' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDraft, setIsDraft] = useState(false);
  const [isBazaar, setIsBazaar] = useState(!!defaultBazaar);
  const [orderNumRaw, setOrderNumRaw] = useState('');
  const [customDate, setCustomDate] = useState(new Date().toISOString().slice(0, 10));
  const [resolvedReturnIds, setResolvedReturnIds] = useState<Set<string>>(new Set());
  const [invoiceDate, setInvoiceDate] = useState('');
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [imageWarnings, setImageWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: pendingReturns = [] } = useQuery({
    queryKey: ['client-returns-pending-point', deliveryPointId],
    queryFn: () => api.get(`/client-returns/pending-by-point/${deliveryPointId}`).then(r => r.data),
    enabled: !!deliveryPointId,
  });

  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: () => api.get('/clients').then((r) => r.data) });
  const { data: products } = useQuery({ queryKey: ['products-active'], queryFn: () => api.get('/products/active').then((r) => r.data) });
  const { data: drivers = [] } = useQuery({ queryKey: ['drivers'], queryFn: () => api.get('/drivers').then((r) => r.data) });
  const { data: cars = [] } = useQuery({ queryKey: ['cars'], queryFn: () => api.get('/cars').then((r) => r.data) });
  const { data: clientPrices = [] } = useQuery({
    queryKey: ['client-prices', clientId, form],
    queryFn: () => clientId ? api.get(`/clients/${clientId}/prices`, { params: { form } }).then((r) => r.data) : Promise.resolve([]),
    enabled: !!clientId,
  });
  const { data: deliveryPoints = [] } = useQuery({
    queryKey: ['delivery-points', clientId],
    queryFn: () => api.get(`/clients/${clientId}/delivery-points`).then((r) => r.data),
    enabled: !!clientId,
  });

  const handleClientChange = async (id: string) => {
    setClientId(id); setDeliveryPointId(''); setAddingPoint(false); setNewPointName('');
    // Для базару — підвантажуємо сталий асортимент, збережений для цього клієнта раніше
    if (isBazaar && id) {
      try {
        const { data } = await api.get(`/bazaar-assortment/${id}`);
        if (Array.isArray(data) && data.length > 0) {
          setItems(data.map((a: any) => ({ productId: a.productId, plannedWeight: '', displayUnit: a.displayUnit || a.product?.unit || 'кг' })));
        }
      } catch {}
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageLoading(true); setImageError(''); setImageWarnings([]);
    try {
      const { base64, mediaType } = await new Promise<{ base64: string; mediaType: string }>((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          const MAX = 1920;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
            else { width = Math.round(width * MAX / height); height = MAX; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не вдалося прочитати зображення')); };
        img.src = url;
      });

      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
      if (!apiKey) { setImageError('VITE_ANTHROPIC_API_KEY не налаштовано'); return; }

      const clientList = (clients as any[])?.filter((c: any) => c.isActive).map((c: any) => `"${c.name}"`).join(', ') ?? '';
      const productList = (products as any[])?.map((p: any) => `"${p.name}"`).join(', ') ?? '';

      const prompt = `Розпізнай замовлення з цього фото.

Список клієнтів у системі: [${clientList}]
Список продуктів у системі: [${productList}]

Правила:
1. Для clientName — вибери ТОЧНУ назву з "Список клієнтів" яка найбільше підходить до того що написано на фото. Якщо схожих немає — порожній рядок.
2. Для кожного productName — вибери ТОЧНУ назву з "Список продуктів" яка найбільше підходить. Якщо немає схожого — все одно пиши найближчий варіант зі списку.
3. КРИТИЧНО: назви продуктів в системі містять тип упаковки (наприклад "в/у" = вакуумна упаковка, "упак." = упаковка, "вагова" = вагова). Якщо на фото є "в/у", "упак.", "уп" — обирай продукт з відповідним позначенням. "вагова" — тільки якщо явно написано. Не плутай упаковані та вагові позиції!
4. unit — "кг" або "шт" або "уп".
5. quantity — число (дробове через крапку).

Поверни ТІЛЬКИ валідний JSON без зайвого тексту:
{"clientName":"...","items":[{"productName":"...","quantity":0.0,"unit":"кг"}],"note":"..."}`;

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType as any, data: base64 } },
              { type: 'text', text: prompt },
            ],
          }],
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        setImageError(`Помилка API: ${resp.status}${errText ? ` — ${errText.slice(0, 120)}` : ''}`);
        return;
      }
      const data = await resp.json();
      const text = data.content?.[0]?.text ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) { setImageError('Не вдалося розпізнати замовлення'); return; }
      let parsed: { clientName: string; items: { productName: string; quantity: number; unit: string }[]; note: string };
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        setImageError('Помилка парсингу відповіді — спробуйте ще раз');
        return;
      }
      const warnings: string[] = [];

      const toWords = (s: string) => s.toLowerCase().split(/[\s,./()–-]+/).filter(w => w.length > 1);
      const wordScore = (a: string, b: string): number => {
        const wa = toWords(a);
        const wb = toWords(b);
        if (!wa.length || !wb.length) return 0;
        const matched = wa.filter(w => wb.some(bw => bw === w || bw.includes(w) || w.includes(bw))).length;
        return matched / Math.max(wa.length, wb.length);
      };
      const fuzzyFind = <T,>(name: string, list: T[], key: (x: T) => string, minScore = 0.35): T | null => {
        const n = name.trim();
        const exact = list.find(x => key(x) === n);
        if (exact) return exact;
        const ci = list.find(x => key(x).toLowerCase() === n.toLowerCase());
        if (ci) return ci;
        let best: T | null = null, bestScore = 0;
        for (const x of list) {
          const s = wordScore(n, key(x));
          if (s > bestScore) { bestScore = s; best = x; }
        }
        return bestScore >= minScore ? best : null;
      };

      if (parsed.clientName) {
        const matched = fuzzyFind(parsed.clientName, (clients as any[]) ?? [], (c: any) => c.name, 0.3);
        if (matched) { setClientId((matched as any).id); setDeliveryPointId(''); }
        else { warnings.push(`Клієнта "${parsed.clientName}" не знайдено — оберіть вручну`); }
      }
      if (parsed.note) setNote(parsed.note);

      const newItems = (parsed.items ?? []).map((ri) => {
        const matched = fuzzyFind(ri.productName, (products as any[]) ?? [], (p: any) => p.name, 0.35);
        if (!matched) { warnings.push(`Продукт "${ri.productName}" не розпізнано — перевірте`); return null; }
        return { productId: (matched as any).id, plannedWeight: String(ri.quantity ?? ''), displayUnit: ri.unit || (matched as any).unit || 'кг' };
      }).filter(Boolean) as { productId: string; plannedWeight: string; displayUnit: string }[];
      if (newItems.length > 0) setItems(newItems);
      else if ((parsed.items ?? []).length > 0) warnings.push('Жоден продукт не вдалося співставити — заповніть вручну');
      setImageWarnings(warnings);
    } catch (err: any) {
      setImageError(err.message || 'Помилка розпізнавання');
    } finally {
      setImageLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleResolveReturn = async (retId: string) => {
    try {
      await api.patch(`/client-returns/${retId}/resolve`);
      setResolvedReturnIds(prev => new Set(prev).add(retId));
      queryClient.invalidateQueries({ queryKey: ['client-returns-pending-point', deliveryPointId] });
    } catch {
      // тихо ігноруємо
    }
  };

  const getPriceForProduct = (productId: string) => {
    const p = clientPrices.find((cp: any) => cp.productId === productId);
    return p ? Number(p.price) : null;
  };
  const getUnit = (productId: string): string => {
    const p = (products as any[])?.find((pr: any) => pr.id === productId);
    return p?.unit ?? 'кг';
  };
  const totalWeight = items.reduce((s, i) => s + (Number(i.plannedWeight) || 0), 0);
  const totalSum = items.reduce((s, i) => {
    if (i.displayUnit !== getUnit(i.productId)) return s;
    const price = getPriceForProduct(i.productId);
    return s + (price ? price * (Number(i.plannedWeight) || 0) : 0);
  }, 0);
  const handleAddPoint = async () => {
    if (!newPointName.trim()) return;
    setSavingPoint(true);
    try {
      const created = await api.post(`/clients/${clientId}/delivery-points`, { name: newPointName.trim() });
      await queryClient.invalidateQueries({ queryKey: ['delivery-points', clientId] });
      setDeliveryPointId(created.data.id);
      setAddingPoint(false); setNewPointName('');
    } catch {} finally { setSavingPoint(false); }
  };
  const handleCreate = async () => {
    if (!clientId) return setError('Оберіть клієнта');
    if (!isDraft && items.some((i) => !i.productId || !i.plannedWeight)) return setError('Заповніть всі позиції');
    setLoading(true); setError('');
    try {
      await api.post('/orders', {
        clientId, form, note, driverName, carNumber,
        deliveryPointId: deliveryPointId || undefined,
        status: isDraft ? 'DRAFT' : 'PENDING',
        isBazaar: isBazaar || undefined,
        numberForm: parseOrderNum(orderNumRaw).num,
        numberSuffix: parseOrderNum(orderNumRaw).suffix || undefined,
        plannedDate: customDate || undefined,
        invoiceDate: invoiceDate || undefined,
        items: isDraft
          ? items.filter((i) => i.productId && i.plannedWeight).map((i) => ({ productId: i.productId, plannedWeight: Number(i.plannedWeight), displayUnit: i.displayUnit }))
          : items.map((i) => ({ productId: i.productId, plannedWeight: Number(i.plannedWeight), displayUnit: i.displayUnit })),
      });
      onCreated(); onClose();
    } catch (e: any) {
      const msg = e.response?.data?.message;
      try {
        const parsed = JSON.parse(msg);
        if (parsed.type === 'DUPLICATE_NUMBER') {
          setError(`⚠️ Накладна №${parsed.numberForm} вже існує. Змініть номер або очистіть поле для автоматичного.`);
        } else if (parsed.type === 'STOCK_SHORTAGE') {
          const lines = parsed.shortages.map((s: any) => `${s.productName}: треба ${s.needed.toFixed(3)}, є ${s.available.toFixed(3)}`);
          setError(`⚠️ Недостатньо товару на складі:\n${lines.join('\n')}`);
        } else {
          setError(msg || 'Помилка створення');
        }
      } catch {
        setError(msg || 'Помилка створення');
      }
    } finally { setLoading(false); }
  };
  const selectedPoint = (deliveryPoints as any[]).find((p) => p.id === deliveryPointId);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
          <div><h2 className="font-bold text-gray-800 text-lg">{isBazaar ? '🏖️ Новий базар' : 'Нова заявка'}</h2><p className="text-xs text-gray-400 mt-0.5">{isBazaar ? 'Видача товару базарнику — списується зі складу одразу' : 'Заповніть дані'}</p></div>
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            <button onClick={() => fileInputRef.current?.click()} disabled={imageLoading}
              className="text-xs font-semibold text-purple-600 border border-purple-200 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              {imageLoading ? '⏳ Розпізнаю...' : '📷 З фото'}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>
        </div>
        {(imageError || imageWarnings.length > 0) && (
          <div className={`px-5 py-3 border-b text-xs space-y-1 ${imageError ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
            {imageError && <div className="text-red-600 font-semibold">⚠️ {imageError}</div>}
            {imageWarnings.map((w, i) => <div key={i} className="text-amber-700">⚠️ {w}</div>)}
          </div>
        )}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Клієнт *</label>
              <select value={clientId} onChange={(e) => handleClientChange(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Оберіть клієнта...</option>
                {clients?.filter((c: any) => c.isActive).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Форма</label>
              <div className="flex rounded-xl border border-gray-300 overflow-hidden text-sm h-[42px]">
                {[{ value: 'FORM_1', label: '🏦 Ф1' }, ...(isInspector ? [] : [{ value: 'FORM_2', label: '💵 Ф2' }])].map((f) => (
                  <button key={f.value} onClick={() => setForm(f.value as Form)}
                    className={`flex-1 font-semibold transition-colors ${form === f.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {clientId && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Точка доставки</label>
              {!addingPoint ? (
                <div className="flex gap-2">
                  <select value={deliveryPointId} onChange={(e) => setDeliveryPointId(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Оберіть точку...</option>
                    {(deliveryPoints as any[]).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button onClick={() => setAddingPoint(true)} className="border border-gray-300 text-gray-600 text-sm px-3 py-2.5 rounded-xl hover:bg-gray-50 font-bold">+</button>
                </div>
              ) : (
                <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-3.5 space-y-2">
                  <div className="text-xs font-bold text-blue-700">📍 Нова точка</div>
                  <input type="text" value={newPointName} onChange={(e) => setNewPointName(e.target.value)}
                    placeholder="Назва магазину"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                  <div className="flex gap-2">
                    <button onClick={() => { setAddingPoint(false); setNewPointName(''); }}
                      className="flex-1 border border-gray-200 text-gray-500 text-xs py-2 rounded-lg">Скасувати</button>
                    <button onClick={handleAddPoint} disabled={savingPoint || !newPointName.trim()}
                      className="flex-1 bg-blue-600 text-white text-xs py-2 rounded-lg disabled:opacity-50 font-bold">{savingPoint ? '...' : '+ Додати'}</button>
                  </div>
                </div>
              )}
              {selectedPoint && !addingPoint && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs"><span>📍</span><span className="font-semibold text-gray-700">{selectedPoint.name}</span></div>
              )}
              {pendingReturns.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-orange-500 text-lg">⚠️</span>
                    <div>
                      <p className="text-sm font-bold text-orange-700">
                        {pendingReturns.length > 1
                          ? `${pendingReturns.length} невраховані повернення з цього магазину`
                          : 'Є невраховане повернення з цього магазину'}
                      </p>
                      <p className="text-xs text-orange-500 mt-0.5">Відмітьте як враховано перед відправкою</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {(pendingReturns as any[]).map((ret: any) => {
                      const isResolved = resolvedReturnIds.has(ret.id);
                      return (
                        <div key={ret.id} className={`border rounded-lg p-3 transition-all ${isResolved ? 'bg-green-50 border-green-200' : 'bg-white border-orange-100'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-orange-600">📅 {new Date(ret.createdAt).toLocaleDateString('uk-UA')}</span>
                              {ret.note && <span className="text-xs text-gray-400 italic truncate max-w-[40%]">{ret.note}</span>}
                            </div>
                            {isResolved ? (
                              <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">✓ Враховано</span>
                            ) : (
                              <button onClick={() => handleResolveReturn(ret.id)}
                                className="text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 px-2.5 py-1 rounded-lg transition-colors">
                                Відмітити ✓
                              </button>
                            )}
                          </div>
                          <div className="space-y-1">
                            {ret.items.map((item: any) => (
                              <div key={item.id} className="grid grid-cols-3 text-xs">
                                <span className={`font-medium ${isResolved ? 'text-gray-400' : 'text-gray-700'}`}>{item.product.name}</span>
                                <span className="text-gray-500 text-center">всього: <b>{Number(item.totalQty).toFixed(3)}</b> {item.product.unit}</span>
                                <div className="text-right space-x-2">
                                  <span className={isResolved ? 'text-gray-400' : 'text-green-600'}>✓ {Number(item.goodQty).toFixed(3)}</span>
                                  {Number(item.wasteQty) > 0 && <span className={isResolved ? 'text-gray-400' : 'text-red-500'}>🗑 {Number(item.wasteQty).toFixed(3)}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {resolvedReturnIds.size < pendingReturns.length && (
                    <p className="text-xs text-orange-500 text-center">Залишилось відмітити: {pendingReturns.length - resolvedReturnIds.size}</p>
                  )}
                  {resolvedReturnIds.size === pendingReturns.length && pendingReturns.length > 0 && (
                    <p className="text-xs text-green-600 font-semibold text-center">✓ Всі повернення враховано</p>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Водій</label>
              <select value={driverName} onChange={(e) => setDriverName(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Оберіть...</option>
                {(drivers as any[]).filter((d) => d.isActive).map((d) => <option key={d.id} value={d.name}>🚗 {d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Авто</label>
              <select value={carNumber} onChange={(e) => setCarNumber(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Оберіть...</option>
                {(cars as any[]).filter((c) => c.isActive).map((c) => <option key={c.id} value={c.number}>🚛 {c.number}{c.brand ? ` · ${c.brand}` : ''}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Позиції *</label>
              {totalWeight > 0 && <span className="text-xs text-gray-400">Всього: <b className="text-gray-700">{totalWeight.toFixed(3)}</b>{totalSum > 0 && <b className="text-green-600 ml-2">{addVat(totalSum).toFixed(2)} ₴</b>}</span>}
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => {
                const price = getPriceForProduct(item.productId);
                const unit = getUnit(item.productId);
                const canCalcPrice = item.displayUnit === unit;
                const lineSum = canCalcPrice && price && item.plannedWeight ? price * Number(item.plannedWeight) : null;
                return (
                  <div key={idx} className={`rounded-xl border p-3 ${item.productId && item.plannedWeight ? 'border-green-200 bg-green-50/40' : 'border-gray-200 bg-gray-50/50'}`}>
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <div className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[10px] font-bold shrink-0">{idx + 1}</div>
                        <select value={item.productId}
                          onChange={(e) => {
                            const selectedProduct = (products as any[])?.find((pr: any) => pr.id === e.target.value);
                            setItems((prev) => prev.map((p, i) => i === idx ? {
                              ...p,
                              productId: e.target.value,
                              displayUnit: selectedProduct?.unit ?? 'кг',
                            } : p));
                          }}
                          className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                          <option value="">Оберіть продукт...</option>
                          {products?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-1 pl-7">
                        {/* FIX 2: прибираємо повзунок у полі кількості */}
                        <input
                          type="number" step="0.001" min="0"
                          value={item.plannedWeight}
                          onChange={(e) => setItems((prev) => prev.map((p, i) => i === idx ? { ...p, plannedWeight: e.target.value } : p))}
                          placeholder="0.000"
                          style={{ MozAppearance: 'textfield' } as any}
                          className="flex-1 sm:flex-none sm:w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <select
                          value={item.displayUnit}
                          onChange={(e) => setItems((prev) => prev.map((p, i) => i === idx ? { ...p, displayUnit: e.target.value } : p))}
                          className="border border-gray-300 rounded-lg px-1.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-600 w-14"
                        >
                          <option value="кг">кг</option>
                          <option value="шт">шт</option>
                          <option value="уп">уп</option>
                        </select>
                        {items.length > 1 && <button onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-xl leading-none shrink-0 px-1">×</button>}
                      </div>
                    </div>
                    {item.productId && (
                      <div className="mt-1.5 pl-7 text-xs flex items-center gap-2">
                        {!canCalcPrice && <span className="text-orange-400">— різні одиниці, ціна не рахується</span>}
                        {canCalcPrice && price && <><span className="text-gray-400">Ціна: <b className="text-gray-600">{price.toFixed(2)} ₴/{unit}</b></span>{lineSum && lineSum > 0 && <b className="text-green-600">= {lineSum.toFixed(2)} ₴</b>}</>}
                        {canCalcPrice && !price && <span className="text-orange-500">⚠️ Ціна не встановлена</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setItems((prev) => [...prev, { productId: '', plannedWeight: '', displayUnit: 'кг' }])}
              className="mt-2 text-blue-600 text-xs hover:text-blue-700 font-semibold">+ Додати позицію</button>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Коментар</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Необов'язково..." />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="text-xs font-bold text-amber-700">✏️ Номер та дати накладної</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Номер накладної</label>
                <input
                  value={orderNumRaw}
                  onChange={(e) => setOrderNumRaw(e.target.value)}
                  placeholder="авто, або 8/ або 567а"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                />
                <div className="text-[10px] text-gray-400 mt-1">
                  {orderNumRaw
                    ? (() => { const { num, suffix } = parseOrderNum(orderNumRaw); return num ? `Номер: ${num}${suffix ? `, суфікс: "${suffix}"` : ''}` : 'Невірний формат'; })()
                    : 'Порожньо — автоматично'}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Дата в накладній</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                />
                <div className="text-[10px] text-gray-400 mt-1">Порожньо — дата виконання заявки</div>
              </div>
            </div>
          </div>
          <div onClick={() => { setIsBazaar(!isBazaar); if (!isBazaar) setIsDraft(false); }}
            className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer select-none ${isBazaar ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}>
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${isBazaar ? 'bg-orange-500 border-orange-500' : 'border-gray-300 bg-white'}`}>
              {isBazaar && <span className="text-white text-xs font-bold">✓</span>}
            </div>
            <div>
              <div className={`text-sm font-semibold ${isBazaar ? 'text-orange-700' : 'text-gray-700'}`}>🏖️ Це базар</div>
              <div className="text-xs text-gray-400 mt-0.5">Видача товару з негайним списанням зі складу; повернення і розрахунок — пізніше, окремо</div>
            </div>
          </div>
          {!isBazaar && (
            <div onClick={() => setIsDraft(!isDraft)}
              className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer select-none ${isDraft ? 'border-slate-400 bg-slate-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}>
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${isDraft ? 'bg-slate-600 border-slate-600' : 'border-gray-300 bg-white'}`}>
                {isDraft && <span className="text-white text-xs font-bold">✓</span>}
              </div>
              <div>
                <div className={`text-sm font-semibold ${isDraft ? 'text-slate-700' : 'text-gray-700'}`}>📋 Зберегти як чернетку</div>
                <div className="text-xs text-gray-400 mt-0.5">Заявка буде в окремому стовпчику — заповни пізніше</div>
              </div>
            </div>
          )}
          {error && <div className="text-red-500 text-sm bg-red-50 border border-red-100 px-4 py-3 rounded-xl whitespace-pre-line">⚠️ {error}</div>}
        </div>
        <div className="border-t bg-gray-50 px-5 py-4 shrink-0 space-y-3">
          {(totalWeight > 0 || clientId) && (
            <div className="flex flex-wrap gap-4 text-xs">
              {clientId && <div className="flex items-center gap-1.5"><span className="text-gray-400">Клієнт:</span><span className="font-semibold text-gray-700">{clients?.find((c: any) => c.id === clientId)?.name}</span><FormBadge form={form} /></div>}
              {selectedPoint && <div className="flex items-center gap-1"><span>📍</span><span className="font-semibold text-gray-700">{selectedPoint.name}</span></div>}
              {totalWeight > 0 && <div className="flex items-center gap-1.5"><span className="text-gray-400">Вага:</span><b className="text-gray-700">{totalWeight.toFixed(3)}</b></div>}
              {totalSum > 0 && <div className="flex items-center gap-1.5"><span className="text-gray-400">Сума (з ПДВ):</span><b className="text-green-600 text-sm">{addVat(totalSum).toFixed(2)} ₴</b></div>}
              {isDraft && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">📋 Чернетка</span>}
              {isBazaar && <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">🏖️ Базар</span>}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-100">Скасувати</button>
            <button onClick={handleCreate} disabled={loading}
              className={`flex-1 text-white text-sm px-4 py-2.5 rounded-xl disabled:opacity-50 font-bold ${isBazaar ? 'bg-orange-600 hover:bg-orange-700' : isDraft ? 'bg-slate-600 hover:bg-slate-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {loading ? 'Створюю...' : isBazaar ? '🏖️ Видати на базар' : isDraft ? '📋 Зберегти чернетку' : '✓ Створити заявку'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EditOrderModal ───────────────────────────────────────────────────────────
function EditOrderModal({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const displayNumber = (order as any).numberForm ?? order.number;
  const isDone = order.status === 'DONE';
  const isBazaar = !!(order as any).isBazaar;
  // Базар можна редагувати завжди, навіть після розрахунку — різниця зі складом коригується автоматично.
  // Звичайну заявку після DONE редагувати не можна (треба спочатку повернути до "В роботі").
  const itemsLocked = isDone && !isBazaar;

  const [clientId, setClientId] = useState(order.clientId);
  const [orderNumRaw, setOrderNumRaw] = useState(
    String((order as any).numberForm ?? '') + ((order as any).numberSuffix ?? ''),
  );
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
      productId: i.productId,
      plannedWeight: String(i.plannedWeight),
      actualWeight: i.actualWeight != null ? String(i.actualWeight) : '',
      returnedWeight: i.returnedWeight != null ? String(i.returnedWeight) : '',
      displayUnit: (i as any).displayUnit || i.product?.unit || 'кг',
      pricePerKg: i.pricePerKg != null ? String(Number(i.pricePerKg)) : '',
    })),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: () => api.get('/clients').then((r) => r.data) });
  const { data: products } = useQuery({ queryKey: ['products-active'], queryFn: () => api.get('/products/active').then((r) => r.data) });
  const { data: drivers = [] } = useQuery({ queryKey: ['drivers'], queryFn: () => api.get('/drivers').then((r) => r.data) });
  const { data: cars = [] } = useQuery({ queryKey: ['cars'], queryFn: () => api.get('/cars').then((r) => r.data) });
  const { data: clientPrices = [] } = useQuery({
    queryKey: ['client-prices', clientId, order.form],
    queryFn: () => api.get(`/clients/${clientId}/prices`, { params: { form: order.form } }).then((r) => r.data),
    enabled: !!clientId,
  });
  const { data: deliveryPoints = [] } = useQuery({
    queryKey: ['delivery-points', clientId],
    queryFn: () => api.get(`/clients/${clientId}/delivery-points`).then((r) => r.data),
    enabled: !!clientId,
  });

  const getPriceForProduct = (productId: string) => {
    const p = (clientPrices as any[]).find((cp: any) => cp.productId === productId);
    return p ? Number(p.price) : null;
  };
  const getUnit = (productId: string): string => {
    const p = (products as any[])?.find((pr: any) => pr.id === productId);
    return p?.unit ?? 'кг';
  };

  const totalWeight = items.reduce((s, i) => s + (Number(i.plannedWeight) || 0), 0);
  const totalSum = items.reduce((s, i) => {
    if (i.displayUnit !== getUnit(i.productId)) return s;
    const effectivePrice = (i.pricePerKg && Number(i.pricePerKg) > 0)
      ? Number(i.pricePerKg)
      : getPriceForProduct(i.productId);
    return s + r2(effectivePrice ? effectivePrice * (Number(i.plannedWeight) || 0) : 0);
  }, 0);

  const handleSave = async () => {
    if (!clientId) return setError('Оберіть клієнта');
    if (!itemsLocked && items.some((i) => !i.productId || !i.plannedWeight)) return setError('Заповніть всі позиції');
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
        ...(!itemsLocked && {
          items: items
            .filter((i) => i.productId && i.plannedWeight)
            .map((i) => ({
              productId: i.productId,
              plannedWeight: Number(i.plannedWeight),
              actualWeight: i.actualWeight ? Number(i.actualWeight) : undefined,
              returnedWeight: isBazaar && i.returnedWeight !== '' ? Number(i.returnedWeight) : undefined,
              displayUnit: i.displayUnit,
              pricePerKg: i.pricePerKg && Number(i.pricePerKg) > 0 ? Number(i.pricePerKg) : undefined,
            })),
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e.response?.data?.message;
      try {
        const parsed = JSON.parse(msg);
        if (parsed.type === 'DUPLICATE_NUMBER') {
          setError(`⚠️ Накладна №${parsed.numberForm} вже існує. Змініть номер.`);
        } else if (parsed.type === 'STOCK_SHORTAGE') {
          const lines = parsed.shortages.map((s: any) => `${s.productName}: треба ${s.needed.toFixed(3)}, є ${s.available.toFixed(3)}`);
          setError(`⚠️ Недостатньо товару на складі:\n${lines.join('\n')}`);
        } else {
          setError(msg || 'Помилка збереження');
        }
      } catch {
        setError(msg || 'Помилка збереження');
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">Редагування №{displayNumber}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              <FormBadge form={order.form} /> <span className={`ml-1 text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_COLOR[order.status]}`}>{STATUS_LABEL[order.status]}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Номер накладної <span className="text-red-500">*</span></label>
            <input
              value={orderNumRaw}
              onChange={(e) => setOrderNumRaw(e.target.value)}
              placeholder="напр. 8 або 8/"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[10px] text-gray-400 mt-1">При зміні — перевіряється на дублікат</p>
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
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Позиції</label>
              {totalWeight > 0 && (
                <span className="text-xs text-gray-400">
                  Всього: <b className="text-gray-700">{totalWeight.toFixed(3)}</b>
                  {totalSum > 0 && <b className="text-green-600 ml-2">{isBazaar ? totalSum.toFixed(2) : addVat(totalSum).toFixed(2)} ₴</b>}
                </span>
              )}
            </div>
            {itemsLocked ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-700">
                {isBazaar
                  ? '⚠️ Розрахунок по базару вже зроблено — кількість позицій змінити неможливо.'
                  : '⚠️ Позиції виконаної заявки не можна змінювати. Поверніть заявку до "В роботі" для редагування позицій.'}
              </div>
            ) : (
              <div className="space-y-2">
                {isBazaar && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-700 mb-2">
                    🏖️ Це базар: товар уже видано зі складу{isDone ? ' і вже зроблено розрахунок' : ''}. Якщо зміниш кількість{isDone ? ' (видано чи повернено)' : ''} — різниця автоматично довантажиться/повернеться на склад.
                  </div>
                )}
                {items.map((item, idx) => {
                  const clientPrice = getPriceForProduct(item.productId);
                  const unit = getUnit(item.productId);
                  const canCalcPrice = item.displayUnit === unit;
                  const effectivePrice = (item.pricePerKg && Number(item.pricePerKg) > 0)
                    ? Number(item.pricePerKg)
                    : clientPrice;
                  const lineSum = canCalcPrice && effectivePrice && item.plannedWeight
                    ? effectivePrice * Number(item.plannedWeight)
                    : null;
                  return (
                    <div key={idx} className={`rounded-xl border p-3 ${item.productId && item.plannedWeight ? 'border-green-200 bg-green-50/40' : 'border-gray-200 bg-gray-50/50'}`}>
                      <div className="space-y-2">
                        <div className="flex gap-2 items-center">
                          <div className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[10px] font-bold shrink-0">{idx + 1}</div>
                          <select value={item.productId}
                            onChange={(e) => {
                              const prod = (products as any[])?.find((p: any) => p.id === e.target.value);
                              const newClientPrice = (clientPrices as any[]).find((cp: any) => cp.productId === e.target.value);
                              setItems((prev) => prev.map((p, i) => i === idx ? {
                                ...p,
                                productId: e.target.value,
                                displayUnit: prod?.unit ?? 'кг',
                                pricePerKg: newClientPrice ? String(Number(newClientPrice.price)) : '',
                              } : p));
                            }}
                            className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                            <option value="">Оберіть продукт...</option>
                            {(products as any[])?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center gap-1 pl-7">
                          {isBazaar && isDone && (
                            <span className="text-[10px] text-gray-400 shrink-0">видано</span>
                          )}
                          {/* FIX 2: прибираємо повзунок */}
                          <input type="number" step="0.001" min="0" value={item.plannedWeight}
                            onChange={(e) => setItems((prev) => prev.map((p, i) => i === idx ? { ...p, plannedWeight: e.target.value } : p))}
                            placeholder="0.000"
                            style={{ MozAppearance: 'textfield' } as any}
                            className="flex-1 sm:flex-none sm:w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                          <select value={item.displayUnit}
                            onChange={(e) => setItems((prev) => prev.map((p, i) => i === idx ? { ...p, displayUnit: e.target.value } : p))}
                            className="border border-gray-300 rounded-lg px-1.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-600 w-14">
                            <option value="кг">кг</option>
                            <option value="шт">шт</option>
                            <option value="уп">уп</option>
                          </select>
                          <button onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0 px-1">×</button>
                        </div>
                        {isBazaar && isDone && (
                          <div className="flex items-center gap-1 pl-7">
                            <span className="text-[10px] text-orange-500 shrink-0 w-[51px]">повернено</span>
                            <input type="number" step="0.001" min="0" max={item.plannedWeight || undefined} value={item.returnedWeight}
                              onChange={(e) => setItems((prev) => prev.map((p, i) => i === idx ? { ...p, returnedWeight: e.target.value } : p))}
                              placeholder="0.000"
                              style={{ MozAppearance: 'textfield' } as any}
                              className="flex-1 sm:flex-none sm:w-20 border border-orange-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-orange-400 bg-orange-50/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                            <span className="text-[10px] text-gray-400">{item.displayUnit}</span>
                            {item.returnedWeight !== '' && (
                              <span className="text-[10px] font-semibold text-orange-600 ml-1">
                                продано: {Math.max(Number(item.plannedWeight || 0) - Number(item.returnedWeight || 0), 0).toFixed(3)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {item.productId && (
                        <div className="mt-2 pl-7 space-y-1">
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide w-16 shrink-0">Ціна/кг</label>
                            {/* FIX 2: прибираємо повзунок */}
                            <input
                              type="number" step="0.01" min="0"
                              value={item.pricePerKg}
                              onChange={(e) => setItems((prev) => prev.map((p, i) => i === idx ? { ...p, pricePerKg: e.target.value } : p))}
                              placeholder={clientPrice ? `${clientPrice.toFixed(2)} (авто)` : 'не встановлено'}
                              style={{ MozAppearance: 'textfield' } as any}
                              className="w-28 border border-gray-200 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                            <span className="text-[10px] text-gray-400">{isBazaar ? 'з ПДВ' : 'без ПДВ'}</span>
                            {lineSum != null && lineSum > 0 && (
                              <span className="text-[10px] font-bold text-green-600">= {isBazaar ? lineSum.toFixed(2) : addVat(lineSum).toFixed(2)} ₴</span>
                            )}
                          </div>
                          {!item.pricePerKg && clientPrice && (
                            <div className="text-[10px] text-gray-400 pl-[72px]">Клієнтська ціна: {clientPrice.toFixed(2)} ₴/кг</div>
                          )}
                          {!item.pricePerKg && !clientPrice && (
                            <div className="text-[10px] text-orange-500 pl-[72px]">⚠️ Ціна не встановлена</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <button onClick={() => setItems((prev) => [...prev, { productId: '', plannedWeight: '', actualWeight: '', returnedWeight: '', displayUnit: 'кг', pricePerKg: '' }])}
                  className="w-full border border-dashed border-gray-300 text-gray-500 text-sm py-2.5 rounded-xl hover:border-blue-400 hover:text-blue-600 transition-colors">
                  + Додати позицію
                </button>
              </div>
            )}
          </div>
          {error && <div className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg whitespace-pre-line">{error}</div>}
        </div>
        <div className="px-5 pb-5 pt-4 border-t flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50">Скасувати</button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 bg-blue-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-bold">
            {loading ? 'Збереження...' : '✓ Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── OrderCardContent — вміст картки ─────────────────────────────────────────
function OrderCardContent({ order, userRole }: { order: Order; userRole: string }) {
  const totalActual = order.items.reduce((s, i) => s + Number(i.actualWeight ?? 0), 0);
  const totalPlanned = order.items.reduce((s, i) => s + Number(i.plannedWeight), 0);
  const displayNumber = (order as any).numberForm ?? order.number;
  const isPrinted = !!(order as any).printedAt;
  const deliveryPoint = (order as any).deliveryPoint;
  const isDraft = order.status === 'DRAFT';

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isDraft ? 'border-slate-200' : 'border-gray-200'}`}>
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-gray-800 text-sm">№{displayNumber}</span>
              <FormBadge form={order.form} />
              {isPrinted && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 font-bold">✓</span>}
              {isDraft && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-semibold">чернетка</span>}
            </div>
            <div className="text-sm text-gray-600 mt-0.5 font-medium truncate">{order.client.name}</div>
            {deliveryPoint && <DeliveryPointBadge point={deliveryPoint} />}
          </div>
          <div className="text-[10px] text-gray-400 shrink-0 font-medium">{new Date(order.createdAt).toLocaleDateString('uk-UA')}</div>
        </div>
        <div className="mt-2.5 space-y-1">
          {order.items.map((item) => {
            // FIX 1: використовуємо displayUnit замість item.product.unit
            const displayUnit = (item as any).displayUnit || item.product.unit;
            return (
              <div key={item.id} className="flex justify-between text-xs text-gray-600">
                <span className="truncate mr-2">{item.product.name}</span>
                <span className="shrink-0">
                  {item.actualWeight
                    ? <span className="text-green-600 font-bold">{Number(item.actualWeight).toFixed(3)} {displayUnit}</span>
                    : <span className="text-gray-500">{Number(item.plannedWeight).toFixed(3)} {displayUnit}</span>}
                </span>
              </div>
            );
          })}
        </div>
        <div className="text-[10px] text-gray-400 border-t border-gray-100 pt-2 mt-2.5 flex gap-3">
          <span>План: <span className="font-semibold text-gray-600">{totalPlanned.toFixed(3)}</span></span>
          {totalActual > 0 && <span>Факт: <span className="font-bold text-green-600">{totalActual.toFixed(3)}</span></span>}
        </div>
        {order.note && <div className="text-[10px] text-gray-500 italic bg-gray-50 px-2 py-1 rounded-lg mt-2">{order.note}</div>}
      </div>
    </div>
  );
}

// ─── DraggableOrderCard ────────────────────────────────────────────────────────
function DraggableOrderCard({ order, onStatusChange, onUpdateWeights, onOpenDetails, onOpenBazaarReturn, onEdit, onDelete, userRole }: {
  order: Order;
  onStatusChange: (id: string, status: OrderStatus) => void;
  onUpdateWeights: (order: Order) => void;
  onOpenDetails: (order: Order) => void;
  onOpenBazaarReturn: (order: Order) => void;
  onEdit: (order: Order) => void;
  onDelete: (id: string) => void;
  userRole: string;
}) {
  const isDraft = order.status === 'DRAFT';
  const isBazaar = !!(order as any).isBazaar;
  const canDrag = !isBazaar && (userRole === 'ADMIN' || (!isDraft && order.status !== 'DONE'));

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: order.id,
    disabled: !canDrag,
    data: { order },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`transition-opacity ${isDragging ? 'opacity-30' : ''} ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div
        className={`bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow ${isDraft ? 'border-slate-200' : 'border-gray-200'}`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div
          onClick={() => onOpenDetails(order)}
          className="p-4 pb-3 cursor-pointer hover:bg-gray-50/60 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-gray-800 text-sm">№{String((order as any).numberForm ?? order.number)}{(order as any).numberSuffix ?? ''}</span>
                <FormBadge form={order.form} />
                {isBazaar && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-bold">🏖️ Базар</span>}
                {!!(order as any).printedAt && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 font-bold">✓</span>}
                {isDraft && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-semibold">чернетка</span>}
              </div>
              <div className="text-sm text-gray-600 mt-0.5 font-medium truncate">{order.client.name}</div>
              {(order as any).deliveryPoint && <DeliveryPointBadge point={(order as any).deliveryPoint} />}
            </div>
            <div className="text-[10px] text-gray-400 shrink-0 font-medium">{new Date(order.createdAt).toLocaleDateString('uk-UA')}</div>
          </div>
          <div className="mt-2.5 space-y-1">
            {order.items.map((item) => {
              // FIX 1: використовуємо displayUnit замість item.product.unit
              const displayUnit = (item as any).displayUnit || item.product.unit;
              return (
                <div key={item.id} className="flex justify-between text-xs text-gray-600">
                  <span className="truncate mr-2">{item.product.name}</span>
                  <span className="shrink-0">
                    {isBazaar && item.returnedWeight != null
                      ? <span className="text-orange-600 font-bold">продано {(Number(item.plannedWeight) - Number(item.returnedWeight)).toFixed(3)} {displayUnit}</span>
                      : item.actualWeight
                      ? <span className="text-green-600 font-bold">{Number(item.actualWeight).toFixed(3)} {displayUnit}</span>
                      : <span className="text-gray-500">{Number(item.plannedWeight).toFixed(3)} {displayUnit}</span>}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-gray-400 border-t border-gray-100 pt-2 mt-2.5 flex gap-3">
            <span>{isBazaar ? 'Видано' : 'План'}: <span className="font-semibold text-gray-600">{order.items.reduce((s, i) => s + Number(i.plannedWeight), 0).toFixed(3)}</span></span>
            {order.items.reduce((s, i) => s + Number(i.actualWeight ?? 0), 0) > 0 && (
              <span>Факт: <span className="font-bold text-green-600">{order.items.reduce((s, i) => s + Number(i.actualWeight ?? 0), 0).toFixed(3)}</span></span>
            )}
          </div>
          {order.note && <div className="text-[10px] text-gray-500 italic bg-gray-50 px-2 py-1 rounded-lg mt-2">{order.note}</div>}
        </div>

        {/* Кнопки дій */}
        <div className="px-4 pb-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3" onPointerDown={(e) => e.stopPropagation()}>
          {isDraft && userRole === 'ADMIN' && (
            <button onClick={() => onStatusChange(order.id, 'PENDING')}
              className="flex-1 bg-slate-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-slate-700 font-semibold">→ В Очікує</button>
          )}
          {order.status === 'PENDING' && isBazaar && (
            <button onClick={() => onOpenBazaarReturn(order)}
              className="flex-1 bg-orange-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-orange-600 font-semibold">📦 Повернення і розрахунок</button>
          )}
          {order.status === 'PENDING' && !isBazaar && (
            <>
              <button onClick={() => onStatusChange(order.id, 'IN_PROGRESS')}
                className="flex-1 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-700 font-semibold">Взяти в роботу</button>
              {userRole === 'ADMIN' && (
                <button onClick={() => onStatusChange(order.id, 'DRAFT')}
                  className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1.5 rounded-lg hover:bg-slate-200 font-semibold">←</button>
              )}
            </>
          )}
          {order.status === 'IN_PROGRESS' && (
            <>
              <button onClick={() => onUpdateWeights(order)}
                className="flex-1 bg-yellow-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-yellow-600 font-semibold">✏️ Вага</button>
              <button onClick={() => onStatusChange(order.id, 'DONE')}
                className="flex-1 bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-700 font-semibold">✓ Готово</button>
            </>
          )}
          {order.status === 'DONE' && userRole === 'ADMIN' && isBazaar && (
            <button onClick={() => onOpenDetails(order)}
              className="flex-1 bg-blue-50 text-blue-700 text-xs px-2 py-1.5 rounded-lg hover:bg-blue-100 font-semibold">📄 Документи / Розрахунок</button>
          )}
          {order.status === 'DONE' && userRole === 'ADMIN' && !isBazaar && (
            <div className="flex gap-1 flex-wrap w-full">
              <button onClick={() => onOpenDetails(order)}
                className="flex-1 bg-blue-50 text-blue-700 text-xs px-2 py-1.5 rounded-lg hover:bg-blue-100 font-semibold">📄 Документи</button>
              <button onClick={() => onUpdateWeights(order)}
                className="bg-yellow-50 text-yellow-700 text-xs px-2.5 py-1.5 rounded-lg hover:bg-yellow-100 font-semibold">✏️</button>
              <button onClick={() => onStatusChange(order.id, 'IN_PROGRESS')}
                className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1.5 rounded-lg hover:bg-gray-200 font-semibold">↩</button>
            </div>
          )}
          {userRole === 'ADMIN' && (
            <div className="flex gap-2 w-full">
              <button onClick={() => onEdit(order)}
                className="flex-1 border border-gray-200 text-gray-500 text-xs py-1.5 rounded-lg hover:bg-gray-50 hover:text-blue-600 hover:border-blue-200 transition-colors font-semibold">
                ✏️ Редагувати
              </button>
              <button onClick={() => onDelete(order.id)}
                className="border border-red-200 text-red-400 text-xs px-2.5 py-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors">
                🗑
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── DroppableColumn ──────────────────────────────────────────────────────────
function DroppableColumn({ id, title, icon, color, orders, onStatusChange, onUpdateWeights, onOpenDetails, onOpenBazaarReturn, onEdit, onDelete, userRole }: {
  id: string; title: string; icon: string; color: string;
  orders: Order[];
  onStatusChange: (id: string, status: OrderStatus) => void;
  onUpdateWeights: (order: Order) => void;
  onOpenDetails: (order: Order) => void;
  onOpenBazaarReturn: (order: Order) => void;
  onEdit: (order: Order) => void;
  onDelete: (id: string) => void;
  userRole: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex-1 min-w-[260px] max-w-sm">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <span className="text-sm">{icon}</span>
        <h3 className="font-bold text-gray-700 text-sm">{title}</h3>
        <span className="ml-auto bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full font-semibold">{orders.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-3 min-h-[100px] rounded-2xl p-2 -m-2 transition-all duration-150 ${
          isOver ? 'bg-blue-50 ring-2 ring-blue-300 ring-dashed' : ''
        }`}
      >
        {orders.length === 0 && !isOver && (
          <div className="text-center text-gray-400 text-sm py-10 border-2 border-dashed border-gray-200 rounded-xl">
            Немає заявок
          </div>
        )}
        {orders.map((order) => (
          <DraggableOrderCard
            key={order.id}
            order={order}
            onStatusChange={onStatusChange}
            onUpdateWeights={onUpdateWeights}
            onOpenDetails={onOpenDetails}
            onOpenBazaarReturn={onOpenBazaarReturn}
            onEdit={onEdit}
            onDelete={onDelete}
            userRole={userRole}
          />
        ))}
      </div>
    </div>
  );
}

// ─── BazaarReturnModal — оформлення повернення з базару і розрахунок різниці ──
function BazaarReturnModal({ order, onClose, onSettled }: { order: Order; onClose: () => void; onSettled: () => void }) {
  const [returns, setReturns] = useState<Record<string, string>>(
    Object.fromEntries(order.items.map((i) => [i.id, ''])),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [settled, setSettled] = useState(false);
  const displayNumber = (order as any).numberForm ?? order.number;

  const rows = order.items.map((item) => {
    const issued = Number(item.plannedWeight);
    const returnedStr = returns[item.id];
    const returned = returnedStr === '' ? null : Number(returnedStr);
    const sold = returned != null ? Math.max(issued - returned, 0) : null;
    const price = Number(item.pricePerKg ?? 0);
    const sum = sold != null && price > 0 ? sold * price : null;
    return { item, issued, returned, sold, price, sum };
  });

  const totalSum = rows.reduce((s, r) => s + (r.sum ?? 0), 0);
  const allFilled = rows.every((r) => r.returned != null && r.returned >= 0 && r.returned <= r.issued);

  const handleSubmit = async () => {
    if (!allFilled) return setError('Вкажіть повернену кількість для всіх позицій (від 0 до виданого)');
    setLoading(true); setError('');
    try {
      await api.patch(`/orders/${order.id}/bazaar-return`, {
        items: rows.map((r) => ({ itemId: r.item.id, returnedWeight: r.returned })),
      });
      setSettled(true);
      onSettled();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Помилка оформлення повернення');
    } finally { setLoading(false); }
  };

  const handlePrintSettlement = async () => {
    try {
      const r = await api.get(`/documents/order/${order.id}/bazaar-settlement`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch { alert('Помилка генерації'); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between shrink-0 bg-orange-50">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">🏖️ Повернення з базару №{displayNumber}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{order.client.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {!settled ? (
          <>
            <div className="overflow-y-auto flex-1 p-5 space-y-3">
              <p className="text-xs text-gray-500">Впиши, скільки базарник привіз назад. Продано = видано − повернено — за це й рахується сума до сплати.</p>
              {rows.map(({ item, issued, returned, sold, sum }) => {
                const displayUnit = (item as any).displayUnit || item.product.unit;
                return (
                  <div key={item.id} className="rounded-xl border border-gray-200 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800">{item.product.name}</span>
                      <span className="text-xs text-gray-400">видано: <b className="text-gray-700">{issued.toFixed(3)} {displayUnit}</b></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 shrink-0 w-20">Повернено</label>
                      <input type="number" min="0" max={issued} step="0.001"
                        value={returns[item.id]}
                        onChange={(e) => setReturns((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder="0.000"
                        className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-orange-400" />
                      <span className="text-xs text-gray-400 shrink-0">{displayUnit}</span>
                    </div>
                    {returned != null && sold != null && (
                      <div className="flex items-center justify-between text-xs bg-orange-50 border border-orange-100 rounded-lg px-2.5 py-1.5">
                        <span className="text-orange-700 font-medium">Продано: {sold.toFixed(3)} {displayUnit}</span>
                        {sum != null ? <span className="font-bold text-orange-700">{sum.toFixed(2)} ₴ (без ПДВ)</span> : <span className="text-gray-400">ціна не задана</span>}
                      </div>
                    )}
                  </div>
                );
              })}
              {error && <div className="text-red-500 text-sm bg-red-50 border border-red-100 px-4 py-3 rounded-xl">⚠️ {error}</div>}
            </div>
            <div className="border-t bg-gray-50 px-5 py-4 shrink-0 space-y-3">
              {totalSum > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">До сплати (з ПДВ):</span>
                  <span className="font-bold text-orange-700 text-lg">{addVat(totalSum).toFixed(2)} ₴</span>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-100">Скасувати</button>
                <button onClick={handleSubmit} disabled={loading || !allFilled}
                  className="flex-1 bg-orange-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-orange-700 disabled:opacity-50 font-bold">
                  {loading ? 'Зберігаю...' : '✓ Зафіксувати і розрахувати'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-6 space-y-4 text-center">
            <div className="text-4xl">✅</div>
            <div className="font-bold text-gray-800">Повернення оформлено, заявку завершено</div>
            {totalSum > 0 && <div className="text-2xl font-bold text-orange-700">{addVat(totalSum).toFixed(2)} ₴</div>}
            <button onClick={handlePrintSettlement}
              className="w-full bg-green-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-green-700 font-bold">
              🧾 Роздрукувати розрахунок
            </button>
            <button onClick={onClose}
              className="w-full border border-gray-200 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50">
              Готово
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── BazaarMenuButton ─────────────────────────────────────────────────────────
function BazaarMenuButton({ onNew, onAssortment }: { onNew: () => void; onAssortment: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false);
  }, []);

  return (
    <div ref={ref} className="relative" onBlur={handleBlur}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 bg-orange-500 text-white text-sm px-4 py-1.5 rounded-xl hover:bg-orange-600 font-semibold shadow-sm"
      >
        🏖️ Базар
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50 min-w-[170px]">
          <button onClick={() => { onNew(); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 font-semibold flex items-center gap-2">
            🏖️ Нова накладна
          </button>
          <div className="border-t border-gray-100 mx-2" />
          <button onClick={() => { onAssortment(); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2">
            ⚙️ Асортимент
          </button>
        </div>
      )}
    </div>
  );
}

// ─── BazaarAssortmentModal ────────────────────────────────────────────────────
function BazaarAssortmentModal({ onClose }: { onClose: () => void }) {
  const [clientId, setClientId] = useState('');
  const [items, setItems] = useState<{ productId: string; displayUnit: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => api.get('/clients').then((r) => r.data) });
  const { data: products = [] } = useQuery({ queryKey: ['products-active'], queryFn: () => api.get('/products/active').then((r) => r.data) });

  const loadAssortment = async (id: string) => {
    setClientId(id); setItems([]); setSaved(false); setError('');
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/bazaar-assortment/${id}`);
      setItems(Array.isArray(data) ? data.map((a: any) => ({ productId: a.productId, displayUnit: a.displayUnit || 'кг' })) : []);
    } catch { setError('Помилка завантаження'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!clientId) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      await api.put(`/bazaar-assortment/${clientId}`, { items: items.filter((i) => i.productId) });
      setSaved(true);
    } catch { setError('Помилка збереження'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between shrink-0 bg-gradient-to-r from-orange-500 to-amber-500">
          <div>
            <h2 className="font-bold text-white text-lg">🏖️ Асортимент базару</h2>
            <p className="text-orange-100 text-xs mt-0.5">Шаблон позицій для нових базарних накладних</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Клієнт (базарник)</label>
            <select value={clientId} onChange={(e) => loadAssortment(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">Оберіть клієнта...</option>
              {(clients as any[]).filter((c: any) => c.isActive).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {clientId && !loading && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Позиції шаблону</label>
                  <button onClick={() => setItems((prev) => [...prev, { productId: '', displayUnit: 'кг' }])}
                    className="text-xs text-orange-600 hover:text-orange-700 font-semibold">+ Додати</button>
                </div>
                {items.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-xl">
                    Немає позицій — додайте товари які має підтягувати базар
                  </p>
                )}
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-orange-50/40 border border-orange-100 rounded-xl px-3 py-2">
                      <select value={item.productId}
                        onChange={(e) => setItems((prev) => prev.map((p, i) => i === idx ? { ...p, productId: e.target.value } : p))}
                        className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
                        <option value="">Продукт...</option>
                        {(products as any[]).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <select value={item.displayUnit}
                        onChange={(e) => setItems((prev) => prev.map((p, i) => i === idx ? { ...p, displayUnit: e.target.value } : p))}
                        className="w-14 border border-gray-300 rounded-lg px-1.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                        <option value="кг">кг</option>
                        <option value="шт">шт</option>
                        <option value="уп">уп</option>
                      </select>
                      <button onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0">×</button>
                    </div>
                  ))}
                </div>
              </div>
              {saved && <div className="text-green-600 text-sm bg-green-50 border border-green-100 px-3 py-2 rounded-xl">✓ Збережено</div>}
              {error && <div className="text-red-500 text-sm bg-red-50 border border-red-100 px-3 py-2 rounded-xl">⚠️ {error}</div>}
            </>
          )}
          {loading && <div className="text-sm text-gray-400 text-center py-6">Завантаження...</div>}
        </div>
        <div className="px-5 py-4 border-t flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50">Закрити</button>
          {clientId && (
            <button onClick={handleSave} disabled={saving}
              className="flex-1 bg-orange-500 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-orange-600 disabled:opacity-50 font-bold">
              {saving ? 'Збереження...' : '✓ Зберегти шаблон'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── OrdersPage ───────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [formFilter, setFormFilter] = useState<Form | ''>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsOrder, setDetailsOrder] = useState<Order | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateBazaar, setShowCreateBazaar] = useState(false);
  const [showBazaarAssortment, setShowBazaarAssortment] = useState(false);
  const [bazaarReturnOrder, setBazaarReturnOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [shortageData, setShortageData] = useState<{
    orderId: string; targetStatus: OrderStatus;
    shortages: { productName: string; needed: number; available: number }[];
    warehouseId: string;
  } | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', formFilter],
    queryFn: () => api.get('/orders', { params: formFilter ? { form: formFilter } : {} }).then((r) => r.data),
    refetchInterval: 30000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    },
    onError: (error: any, variables) => {
      try {
        const parsed = JSON.parse(error.response?.data?.message);
        if (parsed.type === 'STOCK_SHORTAGE') {
          setShortageData({ orderId: variables.id, targetStatus: variables.status, shortages: parsed.shortages, warehouseId: parsed.warehouseId });
          return;
        }
      } catch {}
      alert(error.response?.data?.message || 'Помилка зміни статусу');
    },
  });

  const weightsMutation = useMutation({
    mutationFn: ({ id, items }: { id: string; items: any[] }) => api.patch(`/orders/${id}/items`, { items }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders'] }); setSelectedOrder(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/orders/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders'] }); setDetailsOrder(null); },
    onError: (error: any) => { alert(error.response?.data?.message || 'Помилка видалення'); },
  });

  const COLUMNS: { id: string; status: OrderStatus; title: string; icon: string; color: string; adminOnly?: boolean }[] = [
    { id: 'draft',       status: 'DRAFT',       title: 'Чернетки', icon: '📋', color: 'bg-slate-400',  adminOnly: true },
    { id: 'pending',     status: 'PENDING',     title: 'Очікує',   icon: '⏳', color: 'bg-gray-400' },
    { id: 'in_progress', status: 'IN_PROGRESS', title: 'В роботі', icon: '⚙️', color: 'bg-yellow-400' },
    { id: 'done',        status: 'DONE',        title: 'Зроблено', icon: '✅', color: 'bg-green-400' },
  ];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const getOrdersForColumn = (status: OrderStatus) => {
    if (status === 'DONE') {
      return orders.filter((o: Order) => o.status === 'DONE' && new Date((o as any).completedAt ?? o.updatedAt) >= todayStart);
    }
    return orders.filter((o: Order) => o.status === status);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const order = orders.find((o: Order) => o.id === event.active.id);
    if (order) setActiveOrder(order);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveOrder(null);
    const { active, over } = event;
    if (!over) return;

    const orderId = active.id as string;
    const targetColumnId = over.id as string;
    const order = orders.find((o: Order) => o.id === orderId);
    if (!order) return;

    const targetColumn = COLUMNS.find((c) => c.id === targetColumnId);
    if (!targetColumn) return;

    const targetStatus = targetColumn.status;
    if (targetStatus === order.status) return;

    const allowed = ALLOWED_DRAG[order.status] ?? [];
    if (!allowed.includes(targetStatus)) return;

    if (user?.role !== 'ADMIN' && (order.status === 'DRAFT' || targetStatus === 'DRAFT' || targetStatus === 'DONE')) return;

    statusMutation.mutate({ id: orderId, status: targetStatus });
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="text-gray-400 text-sm">Завантаження...</div></div>;

  const visibleColumns = COLUMNS.filter((c) => !c.adminOnly || user?.role === 'ADMIN');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <h1 className="text-xl font-bold text-gray-800">Заявки</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {user?.role !== 'INSPECTOR' && (
            <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm shadow-sm">
              {[{ value: '', label: 'Всі' }, { value: 'FORM_1', label: 'Ф1' }, { value: 'FORM_2', label: 'Ф2' }].map((f) => (
                <button key={f.value} onClick={() => setFormFilter(f.value as Form | '')}
                  className={`px-3 py-1.5 font-semibold transition-colors ${formFilter === f.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
          {user?.role === 'ADMIN' && (
            <>
              <BazaarMenuButton
                onNew={() => setShowCreateBazaar(true)}
                onAssortment={() => setShowBazaarAssortment(true)}
              />
              <button onClick={() => setShowCreate(true)}
                className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-xl hover:bg-blue-700 font-semibold shadow-sm">
                + Нова заявка
              </button>
            </>
          )}
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {visibleColumns.map((col) => (
            <DroppableColumn
              key={col.id}
              id={col.id}
              title={col.title}
              icon={col.icon}
              color={col.color}
              orders={getOrdersForColumn(col.status)}
              onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
              onUpdateWeights={setSelectedOrder}
              onOpenDetails={setDetailsOrder}
              onOpenBazaarReturn={setBazaarReturnOrder}
              onEdit={setEditingOrder}
              onDelete={(id) => { if (window.confirm('Видалити заявку? Це незворотно.')) deleteMutation.mutate(id); }}
              userRole={user?.role || ''}
            />
          ))}
        </div>

        <DragOverlay>
          {activeOrder && (
            <div className="rotate-2 scale-105 opacity-95 shadow-2xl">
              <OrderCardContent order={activeOrder} userRole={user?.role || ''} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {selectedOrder && (
        <WeightsModal order={selectedOrder} onClose={() => setSelectedOrder(null)}
          onSave={(items) => weightsMutation.mutate({ id: selectedOrder.id, items })}
          userRole={user?.role || ''} />
      )}
      {showBazaarAssortment && <BazaarAssortmentModal onClose={() => setShowBazaarAssortment(false)} />}
      {showCreate && (
        <CreateOrderModal onClose={() => setShowCreate(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ['orders'] })} />
      )}
      {showCreateBazaar && (
        <CreateOrderModal defaultBazaar onClose={() => setShowCreateBazaar(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ['orders'] })} />
      )}
      {bazaarReturnOrder && (
        <BazaarReturnModal order={bazaarReturnOrder} onClose={() => setBazaarReturnOrder(null)}
          onSettled={() => { queryClient.invalidateQueries({ queryKey: ['orders'] }); queryClient.invalidateQueries({ queryKey: ['stock'] }); }} />
      )}
      {detailsOrder && (
        <OrderDetailsModal order={detailsOrder} onClose={() => setDetailsOrder(null)}
          onStatusChange={(id, status) => { statusMutation.mutate({ id, status }); setDetailsOrder(null); }}
          onUpdateWeights={(order) => { setSelectedOrder(order); setDetailsOrder(null); }}
          onOpenBazaarReturn={(order) => { setBazaarReturnOrder(order); setDetailsOrder(null); }}
          onEdit={() => { setEditingOrder(detailsOrder); setDetailsOrder(null); }}
          onDelete={(id) => { if (window.confirm('Видалити заявку? Це незворотно.')) deleteMutation.mutate(id); }}
          userRole={user?.role || ''} />
      )}
      {editingOrder && (
        <EditOrderModal order={editingOrder} onClose={() => setEditingOrder(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['orders'] })} />
      )}
      {shortageData && (
        <ShortageModal data={shortageData} userRole={user?.role || ''}
          onClose={() => setShortageData(null)}
          onTransferred={() => {
            const snap = shortageData;
            statusMutation.mutate(
              { id: snap!.orderId, status: snap!.targetStatus },
              {
                onSuccess: () => { setShortageData(null); },
                onError: (error: any) => {
                  try {
                    const parsed = JSON.parse((error as any).response?.data?.message);
                    if (parsed.type === 'STOCK_SHORTAGE') {
                      setShortageData({ orderId: snap!.orderId, targetStatus: snap!.targetStatus, shortages: parsed.shortages, warehouseId: snap!.warehouseId });
                      return;
                    }
                  } catch {}
                  alert((error as any).response?.data?.message || 'Помилка');
                  setShortageData(null);
                },
              },
            );
          }}
        />
      )}
    </div>
  );
}