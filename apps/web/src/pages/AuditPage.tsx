import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/axios';

const actionLabel: Record<string, string> = {
  ORDER_CREATED: 'Створено заявку',
  ORDER_STATUS_CHANGED: 'Змінено статус',
  ORDER_ITEMS_UPDATED: 'Оновлено вагу',
  ORDER_DELETED: 'Видалено заявку',
};

const actionColor: Record<string, string> = {
  ORDER_CREATED: 'bg-green-100 text-green-700',
  ORDER_STATUS_CHANGED: 'bg-blue-100 text-blue-700',
  ORDER_ITEMS_UPDATED: 'bg-yellow-100 text-yellow-700',
  ORDER_DELETED: 'bg-red-100 text-red-700',
};

const actionIcon: Record<string, string> = {
  ORDER_CREATED: '✚',
  ORDER_STATUS_CHANGED: '↻',
  ORDER_ITEMS_UPDATED: '⚖',
  ORDER_DELETED: '✕',
};

// ============================================================
// Деталі лога — розумне відображення
// ============================================================
function LogDetails({ log }: { log: any }) {
  const [expanded, setExpanded] = useState(false);
  const order = log.order;
  const newVal = log.newValue;
  const oldVal = log.oldValue;

  // Зміна статусу
  if (log.action === 'ORDER_STATUS_CHANGED') {
    const statusLabel: Record<string, string> = {
      PENDING: 'Очікує',
      IN_PROGRESS: 'В роботі',
      DONE: 'Виконано',
      CANCELLED: 'Скасовано',
    };
    const statusColor: Record<string, string> = {
      PENDING: 'bg-gray-100 text-gray-600',
      IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
      DONE: 'bg-green-100 text-green-700',
      CANCELLED: 'bg-red-100 text-red-600',
    };

    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          {oldVal?.status && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[oldVal.status]}`}>
              {statusLabel[oldVal.status] || oldVal.status}
            </span>
          )}
          {oldVal?.status && <span className="text-gray-300 text-sm">→</span>}
          {newVal?.status && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[newVal.status]}`}>
              {statusLabel[newVal.status] || newVal.status}
            </span>
          )}
        </div>
        {order && <OrderInfo order={order} />}
      </div>
    );
  }

  // Оновлення ваги
  if (log.action === 'ORDER_ITEMS_UPDATED') {
    const items = newVal?.items || [];
    const totalActual = items.reduce((s: number, i: any) => s + Number(i.actualWeight || 0), 0);

    return (
      <div className="space-y-2">
        {order && <OrderInfo order={order} />}
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
        >
          {expanded ? '▲' : '▼'} {items.length} позицій
          {totalActual > 0 && (
            <span className="text-gray-500 ml-1">· загалом {totalActual.toFixed(3)} кг</span>
          )}
        </button>

        {expanded && order?.items && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            {order.items.map((item: any) => {
              const newItem = items.find((i: any) => i.itemId === item.id);
              const oldItem = (oldVal?.items || []).find((i: any) => i.id === item.id);
              const actual = newItem?.actualWeight ?? Number(item.actualWeight ?? 0);
              const planned = Number(item.plannedWeight);
              const diff = actual - planned;
              const diffPct = planned > 0 ? (diff / planned * 100) : 0;

              return (
                <div key={item.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 truncate mr-2">{item.product.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-gray-400">{planned.toFixed(3)}</span>
                    <span className="text-gray-300">→</span>
                    <span className="font-medium text-gray-800">{Number(actual).toFixed(3)} {item.product.unit}</span>
                    {actual > 0 && (
                      <span className={`${
                        Math.abs(diffPct) <= 2 ? 'text-green-500'
                          : Math.abs(diffPct) <= 5 ? 'text-yellow-500'
                          : 'text-red-500'
                      }`}>
                        ({diff > 0 ? '+' : ''}{diffPct.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Підсумок */}
            {order.items.length > 0 && (() => {
              const totalPlanned = order.items.reduce(
                (s: number, i: any) => s + Number(i.plannedWeight), 0
              );
              const totalSum = order.items.reduce((s: number, i: any) => {
                const w = Number(i.actualWeight ?? i.plannedWeight);
                return s + w * Number(i.pricePerKg ?? 0);
              }, 0);
              return (
                <div className="pt-2 border-t border-gray-200 flex justify-between text-xs font-medium">
                  <span className="text-gray-500">
                    План: {totalPlanned.toFixed(3)} кг →
                    Факт: {totalActual.toFixed(3)} кг
                  </span>
                  {totalSum > 0 && (
                    <span className="text-green-600">{totalSum.toFixed(2)} ₴</span>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );
  }

  // Створення заявки
  if (log.action === 'ORDER_CREATED') {
    return (
      <div className="space-y-1.5">
        {order && <OrderInfo order={order} showItems />}
      </div>
    );
  }

  // Видалення заявки
  if (log.action === 'ORDER_DELETED') {
    return (
      <div className="space-y-1.5">
        <div className="text-xs text-red-500 font-medium">Заявку видалено</div>
        {oldVal && (
          <div className="text-xs text-gray-500">
            №{oldVal.number} · клієнт: {oldVal.clientId?.slice(0, 8)}...
          </div>
        )}
      </div>
    );
  }

  // Fallback
  if (!newVal && !oldVal) return <span className="text-gray-400 text-xs">—</span>;
  const raw = JSON.stringify(newVal || oldVal);
  return (
    <button
      onClick={() => setExpanded(v => !v)}
      className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600 hover:bg-gray-200 transition-colors text-left"
    >
      {expanded ? raw : (raw.slice(0, 60) + (raw.length > 60 ? '…' : ''))}
    </button>
  );
}

// ============================================================
// Інфо про заявку — використовується в деталях
// ============================================================
function OrderInfo({ order, showItems = false }: { order: any; showItems?: boolean }) {
  if (!order) return null;

  const displayNumber = order.numberForm ?? order.number;
  const total = order.items?.reduce(
    (s: number, i: any) => s + Number(i.actualWeight ?? i.plannedWeight) * Number(i.pricePerKg ?? 0),
    0,
  ) ?? 0;
  const totalWeight = order.items?.reduce(
    (s: number, i: any) => s + Number(i.actualWeight ?? i.plannedWeight),
    0,
  ) ?? 0;

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 space-y-1.5">
      {/* Заголовок заявки */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-blue-800">
          №{displayNumber}
        </span>
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
          order.form === 'FORM_1' ? 'bg-blue-200 text-blue-800' : 'bg-orange-100 text-orange-700'
        }`}>
          {order.form === 'FORM_1' ? 'Ф1' : 'Ф2'}
        </span>
        <span className="text-xs text-blue-600 font-medium">
          {order.client?.name}
        </span>
        {total > 0 && (
          <span className="text-xs text-green-600 font-semibold ml-auto">
            {total.toFixed(2)} ₴
          </span>
        )}
      </div>

      {/* Позиції якщо треба показати */}
      {showItems && order.items?.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-blue-100">
          {order.items.map((item: any) => (
            <div key={item.id} className="flex justify-between text-xs text-blue-700">
              <span className="truncate mr-2">{item.product.name}</span>
              <span className="shrink-0 font-medium">
                {Number(item.plannedWeight).toFixed(3)} {item.product.unit}
                {item.pricePerKg && (
                  <span className="text-blue-500 ml-1">
                    × {Number(item.pricePerKg).toFixed(2)} ₴
                  </span>
                )}
              </span>
            </div>
          ))}
          {totalWeight > 0 && (
            <div className="pt-1 border-t border-blue-100 flex justify-between text-xs font-medium text-blue-700">
              <span>Загалом</span>
              <span>{totalWeight.toFixed(3)} кг</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Головна сторінка
// ============================================================
export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, action, from, to],
    queryFn: () =>
      api.get('/audit', {
        params: {
          ...(action && { action }),
          ...(from && { from }),
          ...(to && { to }),
          page,
          limit: 30,
        },
      }).then((r) => r.data),
  });

  const logs = data?.data || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;
  const hasFilters = !!(action || from || to);

  const resetFilters = () => {
    setAction(''); setFrom(''); setTo(''); setPage(1);
  };

  // Групуємо по даті
  const grouped = logs.reduce((acc: Record<string, any[]>, log: any) => {
    const date = new Date(log.createdAt).toLocaleDateString('uk-UA', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {});

  const getPaginationPages = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Аудит дій</h1>
          {total > 0 && <p className="text-xs text-gray-400 mt-0.5">{total} записів</p>}
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
            showFilters || hasFilters
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          🔍 Фільтри
          {hasFilters && (
            <span className="bg-white text-blue-600 text-xs px-1.5 py-0.5 rounded-full font-bold">
              {[action, from, to].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {/* Фільтри */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Тип дії</label>
              <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Всі дії</option>
                {Object.entries(actionLabel).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Від</label>
              <input type="date" value={from}
                onChange={(e) => { setFrom(e.target.value); setPage(1); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">До</label>
              <input type="date" value={to}
                onChange={(e) => { setTo(e.target.value); setPage(1); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {hasFilters && (
            <button onClick={resetFilters} className="text-xs text-red-500 hover:text-red-700">
              × Скинути фільтри
            </button>
          )}
        </div>
      )}

      {/* Контент */}
      {isLoading ? (
        <div className="text-center text-gray-400 py-12">Завантаження...</div>
      ) : logs.length === 0 ? (
        <div className="text-center text-gray-400 py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <div className="text-4xl mb-3">🔍</div>
          <div className="font-medium text-gray-500">Записів не знайдено</div>
          {hasFilters && (
            <button onClick={resetFilters} className="mt-2 text-xs text-blue-500 hover:text-blue-700">
              Скинути фільтри
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, dateLogs]) => (
            <div key={date}>
              {/* Роздільник дати */}
              <div className="flex items-center gap-3 mb-3">
                <div className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  📅 {date}
                </div>
                <div className="flex-1 h-px bg-gray-100" />
                <div className="text-xs text-gray-400">{dateLogs.length} дій</div>
              </div>

              {/* Таймлайн */}
              <div className="relative">
                <div className="absolute left-[19px] top-0 bottom-0 w-px bg-gray-100" />
                <div className="space-y-3">
                  {dateLogs.map((log: any) => (
                    <div key={log.id} className="flex gap-3">
                      {/* Іконка */}
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 z-10 mt-3 ${
                        actionColor[log.action] || 'bg-gray-100 text-gray-600'
                      }`}>
                        {actionIcon[log.action] || '•'}
                      </div>

                      {/* Картка */}
                      <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all">
                        {/* Шапка картки */}
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              actionColor[log.action] || 'bg-gray-100 text-gray-600'
                            }`}>
                              {actionLabel[log.action] || log.action}
                            </span>

                            {/* Юзер */}
                            <div className="flex items-center gap-1.5">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                                log.user?.role === 'ADMIN' ? 'bg-purple-500'
                                  : log.user?.role === 'WORKER' ? 'bg-blue-500'
                                  : log.user?.role === 'ACCOUNTANT' ? 'bg-green-500'
                                  : 'bg-orange-500'
                              }`}>
                                {log.user?.name?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <span className="text-sm font-medium text-gray-700">
                                {log.user?.name || '—'}
                              </span>
                              <span className="text-xs text-gray-400">
                                {log.user?.role === 'ADMIN' ? '(Адмін)'
                                  : log.user?.role === 'WORKER' ? '(Працівник)'
                                  : log.user?.role === 'ACCOUNTANT' ? '(Бухгалтер)'
                                  : ''}
                              </span>
                            </div>
                          </div>

                          {/* Час */}
                          <span className="text-xs text-gray-400 shrink-0 bg-gray-50 px-2 py-0.5 rounded">
                            🕐 {new Date(log.createdAt).toLocaleTimeString('uk-UA', {
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {/* Деталі */}
                        <LogDetails log={log} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Пагінація */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1 py-2">
              <div className="text-xs text-gray-500">
                {total} записів · сторінка {page} з {totalPages}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  ←
                </button>
                {getPaginationPages().map((p, i) =>
                  p === '...' ? (
                    <span key={`dots-${i}`} className="px-2 text-gray-400 text-sm">…</span>
                  ) : (
                    <button key={p} onClick={() => setPage(p as number)}
                      className={`w-8 h-8 text-xs rounded-lg border transition-colors ${
                        p === page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}>
                      {p}
                    </button>
                  )
                )}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}