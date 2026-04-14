import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import api from '@/api/axios';
import { useAuthStore } from '@/store/auth';

// ============================================================
// Worker Dashboard
// ============================================================
function WorkerDashboard() {
  const { user } = useAuthStore();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders-worker'],
    queryFn: () => api.get('/orders').then((r) => r.data),
    refetchInterval: 30000,
  });

  const activeOrders: any[] = orders.filter((o: any) => o.status === 'IN_PROGRESS');
  const pendingOrders: any[] = orders.filter((o: any) => o.status === 'PENDING');
  const todayDone: any[] = orders.filter(
    (o: any) => o.status === 'DONE' && new Date(o.completedAt).toDateString() === new Date().toDateString()
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Доброго ранку' : hour < 17 ? 'Добрий день' : 'Добрий вечір';

  return (
    <div className="space-y-4 pb-8 max-w-lg mx-auto">
      {/* Шапка */}
      <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-5 overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-12 -right-4 w-56 h-56 bg-white/5 rounded-full" />

        <div className="relative">
          <div className="text-blue-200 text-sm mb-0.5">{greeting} 👋</div>
          <div className="text-white text-xl font-bold mb-4">{user?.name}</div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: '⚡', label: 'В роботі', value: activeOrders.length, highlight: activeOrders.length > 0 },
              { icon: '🕐', label: 'Очікують', value: pendingOrders.length, highlight: false },
              { icon: '✅', label: 'Сьогодні', value: todayDone.length, highlight: false },
            ].map((s) => (
              <div
                key={s.label}
                className={`rounded-xl p-3 text-center ${
                  s.highlight ? 'bg-yellow-400/20 border border-yellow-300/30' : 'bg-white/10'
                }`}
              >
                <div className="text-lg mb-0.5">{s.icon}</div>
                <div className="text-white text-2xl font-bold leading-none">{s.value}</div>
                <div className="text-blue-200 text-xs mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-10 text-gray-400 text-sm">Завантаження...</div>
      )}

      {/* В роботі */}
      {activeOrders.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-gray-700">В роботі зараз ({activeOrders.length})</span>
          </div>
          <div className="space-y-3">
            {activeOrders.map((order: any) => {
              const totalWeight = order.items.reduce((s: number, i: any) => s + Number(i.plannedWeight), 0);
              return (
                <div key={order.id} className="bg-white border-2 border-yellow-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-800 text-lg">№{order.numberForm ?? order.number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          order.form === 'FORM_1' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {order.form === 'FORM_1' ? 'Ф1' : 'Ф2'}
                        </span>
                      </div>
                      <div className="text-gray-600 text-sm mt-0.5 font-medium truncate">{order.client.name}</div>
                      {order.deliveryPoint && (
                        <div className="text-xs text-gray-400 mt-0.5">📍 {order.deliveryPoint.name}</div>
                      )}
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 text-center shrink-0 ml-3">
                      <div className="text-yellow-700 font-bold text-xl leading-none">{totalWeight.toFixed(1)}</div>
                      <div className="text-yellow-500 text-[10px]">кг</div>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-yellow-100 pt-3">
                    {order.items.map((item: any, idx: number) => {
                      const du = item.displayUnit || item.product.unit;
                      const planned = Number(item.plannedWeight);
                      return (
                        <div key={item.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-5 h-5 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {idx + 1}
                            </div>
                            <span className="text-sm text-gray-700 truncate">{item.product.name}</span>
                          </div>
                          <span className="font-bold text-gray-800 text-sm shrink-0 ml-2">
                            {planned.toFixed(du === 'шт' ? 0 : 3)} {du}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {order.note && (
                    <div className="mt-3 bg-yellow-50 border border-yellow-100 rounded-xl px-3 py-2 text-xs text-gray-600">
                      💬 {order.note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Очікують */}
      {pendingOrders.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full" />
            <span className="text-sm font-semibold text-gray-700">Очікують виконання ({pendingOrders.length})</span>
          </div>
          <div className="space-y-2">
            {pendingOrders.map((order: any) => {
              const totalWeight = order.items.reduce((s: number, i: any) => s + Number(i.plannedWeight), 0);
              return (
                <div key={order.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 text-xs font-bold shrink-0">
                      №{order.numberForm ?? order.number}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-700 truncate">{order.client.name}</div>
                      <div className="text-xs text-gray-400">{order.items.length} поз · {totalWeight.toFixed(1)} кг</div>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${
                    order.form === 'FORM_1' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {order.form === 'FORM_1' ? 'Ф1' : 'Ф2'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isLoading && activeOrders.length === 0 && pendingOrders.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🎉</div>
          <div className="font-semibold text-gray-700 text-lg">Все виконано!</div>
          <div className="text-gray-400 text-sm mt-1">Нових заявок поки немає</div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Admin Dashboard
// ============================================================
function AdminDashboard() {
  const { user } = useAuthStore();
  const isInspector = user?.role === 'INSPECTOR';
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('month');

  const getDateRange = () => {
    const to = new Date().toISOString();
    const from = new Date();
    if (period === 'today') from.setHours(0, 0, 0, 0);
    else if (period === 'week') from.setDate(from.getDate() - 7);
    else from.setMonth(from.getMonth() - 1);
    return { from: from.toISOString(), to };
  };

  const { from, to } = getDateRange();
  const formParam = isInspector ? { form: 'FORM_1' } : {};

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', period, isInspector],
    queryFn: () =>
      api.get('/statistics/dashboard', { params: { from, to, ...formParam } }).then((r) => r.data),
  });

  const { data: ordersStats } = useQuery({
    queryKey: ['orders-stats', period, isInspector],
    queryFn: () =>
      api.get('/statistics/orders', { params: { from, to, ...formParam } }).then((r) => r.data),
  });

  const revenue = dashboard?.revenueByForm;
  const totalRevenue = Number(dashboard?.totalRevenue || 0);
  const f1 = Number(revenue?.FORM_1 || 0);
  const f2 = Number(revenue?.FORM_2 || 0);
  const f1Pct = totalRevenue > 0 ? (f1 / totalRevenue * 100) : 0;

  const periodLabel = period === 'today' ? 'сьогодні' : period === 'week' ? 'за тиждень' : 'за місяць';

  return (
    <div className="space-y-5 pb-8">

      {/* Заголовок */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Дашборд</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date().toLocaleDateString('uk-UA', {
              weekday: 'long', day: 'numeric', month: 'long'
            })}
          </p>
        </div>
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm bg-white">
          {[
            { value: 'today', label: 'Сьогодні' },
            { value: 'week', label: 'Тиждень' },
            { value: 'month', label: 'Місяць' },
          ].map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value as typeof period)}
              className={`px-3 py-1.5 transition-colors ${
                period === p.value
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="text-4xl mb-3">🐟</div>
            <div className="text-gray-400 text-sm">Завантаження...</div>
          </div>
        </div>
      ) : (
        <>
          {/* Головний блок виручки */}
          <div className="relative bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 rounded-2xl p-6 overflow-hidden">
            {/* Декор */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-500/10 rounded-full translate-y-1/2 -translate-x-1/4" />

            <div className="relative">
              <div className="text-slate-400 text-xs uppercase tracking-widest mb-2">
                Виручка {periodLabel}
              </div>
              <div className="text-white text-5xl font-bold mb-1">
                {(totalRevenue * 1.2) >= 1000
                  ? `${((totalRevenue * 1.2) / 1000).toFixed(1)}k`
                  : (totalRevenue * 1.2).toFixed(0)}
                <span className="text-2xl font-normal text-slate-400 ml-2">₴</span>
              </div>
              <div className="text-slate-500 text-xs">з ПДВ · без ПДВ: {totalRevenue.toFixed(0)} ₴</div>

              {/* Поділ на форми */}
              {!isInspector && (
                <div className="mt-5 space-y-3">
                  {/* Прогрес бар */}
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-blue-400 transition-all rounded-l-full"
                      style={{ width: `${f1Pct}%` }}
                    />
                    <div
                      className="h-full bg-orange-400 transition-all rounded-r-full"
                      style={{ width: `${100 - f1Pct}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-400 shrink-0" />
                        <span className="text-slate-400 text-xs">Форма 1 · безнал</span>
                      </div>
                      <div className="text-white font-bold text-lg">{(f1 * 1.2).toFixed(0)} ₴</div>
                      <div className="text-slate-500 text-xs">{f1Pct.toFixed(0)}% · з ПДВ</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-orange-400 shrink-0" />
                        <span className="text-slate-400 text-xs">Форма 2 · готівка</span>
                      </div>
                      <div className="text-white font-bold text-lg">{(f2 * 1.2).toFixed(0)} ₴</div>
                      <div className="text-slate-500 text-xs">{(100 - f1Pct).toFixed(0)}% · з ПДВ</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Статистика заявок */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                icon: '✅',
                label: 'Виконано',
                value: ordersStats?.done || 0,
                bg: 'bg-emerald-50',
                text: 'text-emerald-700',
                border: 'border-emerald-100',
              },
              {
                icon: '⚡',
                label: 'В роботі',
                value: dashboard?.activeOrders || 0,
                bg: 'bg-amber-50',
                text: 'text-amber-700',
                border: 'border-amber-100',
              },
              {
                icon: '🕐',
                label: 'Очікують',
                value: ordersStats?.pending || 0,
                bg: 'bg-slate-50',
                text: 'text-slate-600',
                border: 'border-slate-100',
              },
              {
                icon: '❌',
                label: 'Скасовано',
                value: ordersStats?.cancelled || 0,
                bg: 'bg-red-50',
                text: 'text-red-600',
                border: 'border-red-100',
              },
            ].map((s) => (
              <div
                key={s.label}
                className={`${s.bg} border ${s.border} rounded-2xl p-4`}
              >
                <div className="text-2xl mb-2">{s.icon}</div>
                <div className={`text-3xl font-bold ${s.text}`}>{s.value}</div>
                <div className={`text-xs mt-1 ${s.text} opacity-70`}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Топ клієнтів + Склади */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

            {/* Топ клієнтів */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">🏆 Топ клієнтів</h2>
                <p className="text-xs text-gray-400 mt-0.5">{periodLabel}</p>
              </div>
              <div className="p-4">
                {!dashboard?.topClients?.length ? (
                  <div className="text-gray-400 text-sm text-center py-8">Немає даних</div>
                ) : (
                  <div className="space-y-4">
                    {dashboard.topClients.slice(0, 5).map((client: any, idx: number) => {
                      const maxRevenue = Number(dashboard.topClients[0].revenue);
                      const pct = maxRevenue > 0
                        ? (Number(client.revenue) / maxRevenue * 100)
                        : 0;
                      const medals = ['🥇', '🥈', '🥉'];

                      return (
                        <div key={client.clientId}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base shrink-0">
                                {medals[idx] || `${idx + 1}.`}
                              </span>
                              <span className="text-sm text-gray-700 font-medium truncate">
                                {client.clientName}
                              </span>
                            </div>
                            <span className="text-sm font-bold text-gray-800 shrink-0 ml-2">
                              {(Number(client.revenue) * 1.2).toFixed(0)} ₴
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${
                                idx === 0 ? 'bg-yellow-400'
                                  : idx === 1 ? 'bg-gray-400'
                                  : idx === 2 ? 'bg-orange-400'
                                  : 'bg-blue-300'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {client.ordersCount} заявок{Number(client.totalWeightKg) > 0 ? ` · ${Number(client.totalWeightKg).toFixed(1)} кг` : ''}{Number(client.totalPcs) > 0 ? ` · ${Math.round(Number(client.totalPcs))} шт` : ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Залишки на складах */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">❄️ Залишки на складах</h2>
                <p className="text-xs text-gray-400 mt-0.5">Поточний стан</p>
              </div>
              <div className="p-4">
                {!dashboard?.stock?.length ? (
                  <div className="text-gray-400 text-sm text-center py-8">Немає даних</div>
                ) : (
                  <div className="space-y-3">
                    {dashboard.stock.map((warehouse: any) => {
                      const items = (warehouse.stockItems || []).filter(
                        (i: any) => Number(i.quantity) > 0
                      );
                      const totalKg = items.filter((i: any) => i.product.unit === 'кг').reduce((s: number, i: any) => s + Number(i.quantity), 0);
                      const totalPcs = items.filter((i: any) => i.product.unit === 'шт').reduce((s: number, i: any) => s + Number(i.quantity), 0);

                      return (
                        <div
                          key={warehouse.id}
                          className="border border-gray-100 rounded-xl p-3"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-base">❄️</span>
                              <span className="text-xs font-semibold text-gray-700">
                                {warehouse.name}
                              </span>
                            </div>
                            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                              {[totalKg > 0 ? `${totalKg.toFixed(1)} кг` : '', totalPcs > 0 ? `${Math.round(totalPcs)} шт` : ''].filter(Boolean).join(' + ') || '0'}
                            </span>
                          </div>

                          {items.length === 0 ? (
                            <div className="text-xs text-gray-400 italic pl-1">Порожньо</div>
                          ) : (
                            <div className="space-y-1">
                              {items.slice(0, 4).map((item: any) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between text-xs"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      item.form === 'FORM_1'
                                        ? 'bg-blue-50 text-blue-600'
                                        : 'bg-orange-50 text-orange-600'
                                    }`}>
                                      {item.form === 'FORM_1' ? 'Ф1' : 'Ф2'}
                                    </span>
                                    <span className="text-gray-600 truncate">{item.product.name}</span>
                                  </div>
                                  <span className="font-semibold text-gray-800 shrink-0 ml-2">
                                    {Number(item.quantity).toFixed(1)} {item.product.unit}
                                  </span>
                                </div>
                              ))}
                              {items.length > 4 && (
                                <div className="text-xs text-gray-400 text-center pt-1">
                                  +{items.length - 4} ще...
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Останні заявки */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">📋 Останні виконані</h2>
            </div>
            {!dashboard?.lastOrders?.length ? (
              <div className="text-gray-400 text-sm text-center py-8">Немає виконаних заявок</div>
            ) : (
              <>
                {/* Мобільний вид */}
                <div className="sm:hidden divide-y divide-gray-100">
                  {dashboard.lastOrders.map((order: any) => {
                    const total = order.items.reduce((s: number, i: any) => {
                      if (i.product?.unit === 'шт' && !i.actualWeight) return s;
                      return s + Number(i.actualWeight ?? i.plannedWeight) * Number(i.pricePerKg ?? 0);
                    }, 0);
                    const displayNumber = order.numberForm ?? order.number;
                    return (
                      <div key={order.id} className="px-5 py-3.5">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800">№{displayNumber}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              order.form === 'FORM_1' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              {order.form === 'FORM_1' ? 'Ф1' : 'Ф2'}
                            </span>
                          </div>
                          <span className="font-bold text-emerald-600">{total > 0 ? `${(total * 1.2).toFixed(0)} ₴` : '—'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 truncate max-w-[60%]">{order.client.name}</span>
                          <span className="text-xs text-gray-400">{new Date(order.completedAt).toLocaleDateString('uk-UA')}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Десктопний вид */}
                <table className="hidden sm:table w-full text-sm">
                  <thead className="bg-gray-50/80">
                    <tr className="text-left text-xs text-gray-400">
                      <th className="px-5 py-3 font-medium">Заявка</th>
                      <th className="px-5 py-3 font-medium">Клієнт</th>
                      <th className="px-5 py-3 font-medium">Форма</th>
                      <th className="px-5 py-3 font-medium text-right">Сума</th>
                      <th className="px-5 py-3 font-medium text-right">Дата</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {dashboard.lastOrders.map((order: any) => {
                      const total = order.items.reduce((s: number, i: any) => {
                        if (i.product?.unit === 'шт' && !i.actualWeight) return s;
                        return s + Number(i.actualWeight ?? i.plannedWeight) * Number(i.pricePerKg ?? 0);
                      }, 0);
                      const displayNumber = order.numberForm ?? order.number;
                      return (
                        <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3">
                            <span className="font-bold text-gray-800">№{displayNumber}</span>
                          </td>
                          <td className="px-5 py-3 text-gray-600 max-w-[140px] truncate">
                            {order.client.name}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              order.form === 'FORM_1' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              {order.form === 'FORM_1' ? 'Ф1' : 'Ф2'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-emerald-600">
                            {total > 0 ? `${(total * 1.2).toFixed(0)} ₴` : '—'}
                          </td>
                          <td className="px-5 py-3 text-right text-gray-400 text-xs">
                            {new Date(order.completedAt).toLocaleDateString('uk-UA')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  if (user?.role === 'WORKER') return <WorkerDashboard />;
  return <AdminDashboard />;
}
