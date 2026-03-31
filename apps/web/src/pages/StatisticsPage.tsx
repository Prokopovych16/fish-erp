import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/axios';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

function StatCard({ label, value, sub, trend, color = 'blue', icon }: {
  label: string; value: string | number; sub?: string; trend?: number;
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'gray'; icon?: string;
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    gray: 'bg-gray-50 text-gray-700 border-gray-100',
  };
  return (
    <div className={`rounded-xl p-4 border ${colors[color]}`}>
      <div className="flex items-start justify-between">
        <div className="text-xs font-medium opacity-70 mb-1">{label}</div>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
      {trend !== undefined && (
        <div className={`text-xs mt-1 font-medium ${trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-500' : 'text-gray-400'}`}>
          {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend).toFixed(1)}% vs попередній
        </div>
      )}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="text-xs">
          {p.name}: <span className="font-semibold">{Number(p.value).toFixed(2)}</span>
        </p>
      ))}
    </div>
  );
}

type TabType = 'overview' | 'finance' | 'orders' | 'clients' | 'products' | 'workers' | 'production';

export default function StatisticsPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year' | 'custom'>('month');
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const getDateRange = () => {
    const to = new Date();
    const from = new Date();
    if (period === 'custom' && customFrom && customTo) {
      return { from: new Date(customFrom).toISOString(), to: new Date(customTo + 'T23:59:59').toISOString(), prevFrom: '', prevTo: '' };
    }
    if (period === 'week') from.setDate(from.getDate() - 7);
    else if (period === 'month') from.setMonth(from.getMonth() - 1);
    else if (period === 'quarter') from.setMonth(from.getMonth() - 3);
    else from.setFullYear(from.getFullYear() - 1);
    const prevTo = new Date(from);
    const prevFrom = new Date(from);
    if (period === 'week') prevFrom.setDate(prevFrom.getDate() - 7);
    else if (period === 'month') prevFrom.setMonth(prevFrom.getMonth() - 1);
    else if (period === 'quarter') prevFrom.setMonth(prevFrom.getMonth() - 3);
    else prevFrom.setFullYear(prevFrom.getFullYear() - 1);
    return { from: from.toISOString(), to: to.toISOString(), prevFrom: prevFrom.toISOString(), prevTo: prevTo.toISOString() };
  };

  const { from, to, prevFrom, prevTo } = getDateRange();
  const params = { from, to };
  const prevParams = { from: prevFrom, to: prevTo };
  const queryKey = [period, customFrom, customTo];
  const enabled = period !== 'custom' || (!!customFrom && !!customTo);

  const { data: finance } = useQuery({ queryKey: ['stat-finance', ...queryKey], queryFn: () => api.get('/statistics/finance', { params }).then(r => r.data), enabled });
  const { data: prevFinance } = useQuery({ queryKey: ['stat-finance-prev', ...queryKey], queryFn: () => api.get('/statistics/finance', { params: prevParams }).then(r => r.data), enabled: period !== 'custom' && !!prevFrom });
  const { data: ordersStats } = useQuery({ queryKey: ['stat-orders', ...queryKey], queryFn: () => api.get('/statistics/orders', { params }).then(r => r.data), enabled });
  const { data: clients } = useQuery({ queryKey: ['stat-clients', ...queryKey], queryFn: () => api.get('/statistics/clients', { params }).then(r => r.data), enabled });
  const { data: products } = useQuery({ queryKey: ['stat-products', ...queryKey], queryFn: () => api.get('/statistics/products', { params }).then(r => r.data), enabled });
  const { data: workers } = useQuery({ queryKey: ['stat-workers', ...queryKey], queryFn: () => api.get('/statistics/workers', { params }).then(r => r.data), enabled });
  const { data: chart } = useQuery({ queryKey: ['stat-chart', ...queryKey], queryFn: () => api.get('/statistics/chart', { params }).then(r => r.data), enabled });
  const { data: production } = useQuery({ queryKey: ['stat-production', ...queryKey], queryFn: () => api.get('/statistics/production', { params }).then(r => r.data), enabled });

  const revenueTrend = finance && prevFinance && prevFinance.total > 0 ? ((finance.total - prevFinance.total) / prevFinance.total) * 100 : undefined;
  const f1Trend = finance && prevFinance && prevFinance.FORM_1 > 0 ? ((finance.FORM_1 - prevFinance.FORM_1) / prevFinance.FORM_1) * 100 : undefined;
  const f2Trend = finance && prevFinance && prevFinance.FORM_2 > 0 ? ((finance.FORM_2 - prevFinance.FORM_2) / prevFinance.FORM_2) * 100 : undefined;

  const formPieData = finance ? [
    { name: 'Форма 1 (безнал)', value: Number(finance.FORM_1 || 0) },
    { name: 'Форма 2 (готівка)', value: Number(finance.FORM_2 || 0) },
  ] : [];

  const statusPieData = ordersStats ? [
    { name: 'Виконано', value: ordersStats.done || 0 },
    { name: 'Скасовано', value: ordersStats.cancelled || 0 },
    { name: 'В роботі', value: ordersStats.inProgress || 0 },
    { name: 'Очікує', value: ordersStats.pending || 0 },
  ].filter(d => d.value > 0) : [];

  const presets = [
    { label: 'Цей тиждень', from: (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d.toISOString().split('T')[0]; })(), to: today },
    { label: 'Цей місяць', from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], to: today },
    { label: 'Минулий місяць', from: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0], to: new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split('T')[0] },
    { label: 'Останні 30 днів', from: (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; })(), to: today },
    { label: 'Останні 90 днів', from: (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split('T')[0]; })(), to: today },
  ];

  const tabs: { value: TabType; label: string }[] = [
    { value: 'overview', label: '📊 Огляд' },
    { value: 'finance', label: '💰 Фінанси' },
    { value: 'orders', label: '📋 Заявки' },
    { value: 'clients', label: '🤝 Клієнти' },
    { value: 'products', label: '🐟 Продукція' },
    { value: 'workers', label: '👷 Працівники' },
    { value: 'production', label: '⚙️ Виробництво' },
  ];

  const isCustomIncomplete = period === 'custom' && (!customFrom || !customTo);

  return (
    <div className="space-y-4 pb-8">
      {/* Заголовок і фільтри */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-800">Статистика</h1>
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              {[{ value: 'week', label: 'Тиждень' }, { value: 'month', label: 'Місяць' }, { value: 'quarter', label: 'Квартал' }, { value: 'year', label: 'Рік' }].map((p) => (
                <button key={p.value} onClick={() => { setPeriod(p.value as any); setShowCustom(false); }}
                  className={`px-3 py-1.5 transition-colors ${period === p.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <button onClick={() => { setShowCustom(v => !v); setPeriod('custom'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${period === 'custom' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              📅 {customFrom && customTo && period === 'custom' ? `${customFrom} — ${customTo}` : 'Діапазон'}
            </button>
          </div>
        </div>

        {showCustom && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
            <div className="text-xs font-medium text-blue-700">Оберіть діапазон дат</div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-blue-600 mb-1">Від</label>
                <input type="date" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); setPeriod('custom'); }} max={customTo || today}
                  className="border border-blue-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-blue-600 mb-1">До</label>
                <input type="date" value={customTo} onChange={(e) => { setCustomTo(e.target.value); setPeriod('custom'); }} min={customFrom} max={today}
                  className="border border-blue-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {customFrom && customTo && (
                <div className="text-xs text-blue-600 font-medium py-2">
                  {Math.ceil((new Date(customTo).getTime() - new Date(customFrom).getTime()) / (1000 * 60 * 60 * 24)) + 1} днів
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset) => (
                <button key={preset.label} onClick={() => { setCustomFrom(preset.from); setCustomTo(preset.to); setPeriod('custom'); }}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${customFrom === preset.from && customTo === preset.to ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-100'}`}>
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {isCustomIncomplete && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-700">
            ⚠️ Оберіть обидві дати для перегляду статистики
          </div>
        )}
      </div>

      {/* Таби */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value)}
            className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${activeTab === tab.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {isCustomIncomplete ? null : (
        <>
          {/* ── ОГЛЯД ── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Загальна виручка" value={`${Number(finance?.total || 0).toFixed(0)} ₴`} trend={revenueTrend} color="blue" icon="💰" />
                <StatCard label="Ф1 (безнал)" value={`${Number(finance?.FORM_1 || 0).toFixed(0)} ₴`} trend={f1Trend} color="green" icon="🏦" />
                <StatCard label="Ф2 (готівка)" value={`${Number(finance?.FORM_2 || 0).toFixed(0)} ₴`} trend={f2Trend} color="orange" icon="💵" />
                <StatCard label="Виконано заявок" value={ordersStats?.done || 0} sub={`Скасовано: ${ordersStats?.cancelled || 0}`} color="purple" icon="✅" />
              </div>

              {chart && chart.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Виручка по днях</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chart}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="revenue" name="Виручка" stroke="#3b82f6" fill="url(#colorRevenue)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Топ клієнтів</h3>
                  {clients?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={clients?.slice(0, 5)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="clientName" tick={{ fontSize: 10 }} width={80} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="revenue" name="Виручка" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="text-center text-gray-400 py-8 text-sm">Немає даних</div>}
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Розподіл по формах</h3>
                  {formPieData.some(d => d.value > 0) ? (
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="60%" height={180}>
                        <PieChart>
                          <Pie data={formPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                            <Cell fill="#3b82f6" /><Cell fill="#f97316" />
                          </Pie>
                          <Tooltip formatter={(v: any) => [`${Number(v).toFixed(2)} ₴`]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-2">
                        {formPieData.map((d, i) => {
                          const total = formPieData.reduce((s, x) => s + x.value, 0);
                          const pct = total > 0 ? (d.value / total * 100).toFixed(1) : 0;
                          return (
                            <div key={i}>
                              <div className="flex items-center gap-2 text-xs">
                                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: i === 0 ? '#3b82f6' : '#f97316' }} />
                                <span className="text-gray-600">{d.name}</span>
                              </div>
                              <div className="text-sm font-semibold text-gray-800 ml-5">{Number(d.value).toFixed(0)} ₴ <span className="text-xs text-gray-400">({pct}%)</span></div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : <div className="text-center text-gray-400 py-8 text-sm">Немає даних</div>}
                </div>
              </div>
            </div>
          )}

          {/* ── ФІНАНСИ ── */}
          {activeTab === 'finance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard label="Загальна виручка" value={`${Number(finance?.total || 0).toFixed(2)} ₴`} color="blue" icon="💰" trend={revenueTrend} />
                <StatCard label="Форма 1 (безнал)" value={`${Number(finance?.FORM_1 || 0).toFixed(2)} ₴`} color="green" icon="🏦" trend={f1Trend} />
                <StatCard label="Форма 2 (готівка)" value={`${Number(finance?.FORM_2 || 0).toFixed(2)} ₴`} color="orange" icon="💵" trend={f2Trend} />
              </div>

              {chart && chart.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Динаміка виручки по днях</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="revenue" name="Виручка" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Ф1 vs Ф2</h3>
                  {formPieData.some(d => d.value > 0) ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={formPieData} cx="50%" cy="50%" outerRadius={90} dataKey="value"
                          label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                          <Cell fill="#3b82f6" /><Cell fill="#f97316" />
                        </Pie>
                        <Tooltip formatter={(v: any) => [`${Number(v).toFixed(2)} ₴`]} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <div className="text-center text-gray-400 py-8 text-sm">Немає даних</div>}
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Деталізація</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Загальна виручка', value: finance?.total, color: 'text-blue-600' },
                      { label: 'Форма 1 (безнал)', value: finance?.FORM_1, color: 'text-green-600' },
                      { label: 'Форма 2 (готівка)', value: finance?.FORM_2, color: 'text-orange-500' },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                        <span className="text-sm text-gray-600">{row.label}</span>
                        <span className={`font-bold text-base ${row.color}`}>{Number(row.value || 0).toFixed(2)} ₴</span>
                      </div>
                    ))}
                    {prevFinance && period !== 'custom' && (
                      <div className="pt-2 border-t">
                        <div className="text-xs text-gray-400 mb-2">Попередній період</div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Виручка</span>
                          <span className="font-medium">{Number(prevFinance.total || 0).toFixed(2)} ₴</span>
                        </div>
                        {revenueTrend !== undefined && (
                          <div className={`text-xs mt-1 font-medium ${revenueTrend > 0 ? 'text-green-600' : revenueTrend < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                            {revenueTrend > 0 ? '↑' : '↓'} {Math.abs(revenueTrend).toFixed(1)}% відносно попереднього
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── ЗАЯВКИ ── */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Виконано" value={ordersStats?.done || 0} color="green" icon="✅" />
                <StatCard label="Скасовано" value={ordersStats?.cancelled || 0} color="red" icon="❌" />
                <StatCard label="В роботі" value={ordersStats?.inProgress || 0} color="orange" icon="⚡" />
                <StatCard label="Середній час" value={`${Number(ordersStats?.avgCompletionHours || 0).toFixed(1)} год`} color="purple" icon="⏱️" />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Розподіл по статусах</h3>
                  {statusPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={statusPieData} cx="50%" cy="50%" outerRadius={90} dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                          {statusPieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                        </Pie>
                        <Tooltip /><Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <div className="text-center text-gray-400 py-8 text-sm">Немає даних</div>}
                </div>

                {chart && chart.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Кількість заявок по днях</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={chart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="count" name="Заявок" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Деталізація</h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {[
                    { label: 'Всього виконано', value: ordersStats?.done || 0, unit: 'заявок' },
                    { label: 'Скасовано', value: ordersStats?.cancelled || 0, unit: 'заявок' },
                    { label: '% скасованих', value: `${Number(ordersStats?.cancelledPercent || 0).toFixed(1)}%`, unit: '' },
                    { label: 'В роботі зараз', value: ordersStats?.inProgress || 0, unit: 'заявок' },
                    { label: 'Очікують', value: ordersStats?.pending || 0, unit: 'заявок' },
                    { label: 'Середній час', value: `${Number(ordersStats?.avgCompletionHours || 0).toFixed(1)}`, unit: 'год' },
                  ].map((row) => (
                    <div key={row.label} className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">{row.label}</div>
                      <div className="text-xl font-bold text-gray-800">{row.value} <span className="text-sm font-normal text-gray-400">{row.unit}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── КЛІЄНТИ ── */}
          {activeTab === 'clients' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Топ клієнтів за виручкою</h3>
                {clients?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={clients?.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="clientName" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="revenue" name="Виручка" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                        {clients?.slice(0, 10).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="text-center text-gray-400 py-8 text-sm">Немає даних</div>}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-xs text-gray-500">
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Клієнт</th>
                      <th className="px-4 py-3 font-medium text-right">Заявок</th>
                      <th className="px-4 py-3 font-medium text-right">Вага (кг)</th>
                      <th className="px-4 py-3 font-medium text-right">Виручка</th>
                      <th className="px-4 py-3 font-medium text-right">Частка</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {clients?.map((client: any, idx: number) => {
                      const totalRevenue = clients.reduce((s: number, c: any) => s + Number(c.revenue), 0);
                      const share = totalRevenue > 0 ? (Number(client.revenue) / totalRevenue * 100) : 0;
                      return (
                        <tr key={client.clientId} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: COLORS[idx % COLORS.length] }}>{idx + 1}</div>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-800">{client.clientName}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{client.ordersCount}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{Number(client.totalWeight).toFixed(1)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-green-600">{Number(client.revenue).toFixed(2)} ₴</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${share}%` }} /></div>
                              <span className="text-xs text-gray-500">{share.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── ПРОДУКЦІЯ ── */}
          {activeTab === 'products' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Обсяг продажів по продуктах (кг)</h3>
                {products?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={products}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="productName" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip /><Legend />
                      <Bar dataKey="totalPlanned" name="План (кг)" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="totalActual" name="Факт (кг)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="text-center text-gray-400 py-8 text-sm">Немає даних</div>}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200"><h3 className="text-sm font-semibold text-gray-700">Відхилення факт від плану</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-xs text-gray-500">
                        <th className="px-4 py-3 font-medium">Продукт</th>
                        <th className="px-4 py-3 font-medium text-right">План (кг)</th>
                        <th className="px-4 py-3 font-medium text-right">Факт (кг)</th>
                        <th className="px-4 py-3 font-medium text-right">Відхилення</th>
                        <th className="px-4 py-3 font-medium text-right">Виручка</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {products?.map((p: any) => {
                        const diff = Number(p.deviationPercent || 0);
                        return (
                          <tr key={p.productId} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-800">{p.productName}</td>
                            <td className="px-4 py-3 text-right text-gray-500">{Number(p.totalPlanned).toFixed(1)}</td>
                            <td className="px-4 py-3 text-right text-gray-700 font-medium">{Number(p.totalActual).toFixed(1)}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${Math.abs(diff) < 2 ? 'bg-green-100 text-green-700' : Math.abs(diff) < 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-green-600">{Number(p.revenue || 0).toFixed(2)} ₴</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {products?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Частки продуктів у виручці</h3>
                  <div className="flex flex-wrap items-center gap-4">
                    <ResponsiveContainer width="60%" height={200}>
                      <PieChart>
                        <Pie data={products?.map((p: any) => ({ name: p.productName, value: Number(p.revenue || 0) }))} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                          {products?.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => [`${Number(v).toFixed(2)} ₴`]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-1.5">
                      {products?.map((p: any, i: number) => (
                        <div key={p.productId} className="flex items-center gap-2 text-xs">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-gray-600 truncate">{p.productName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ПРАЦІВНИКИ ── */}
          {activeTab === 'workers' && (
            <div className="space-y-6">
              {workers?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Виконано заявок по працівниках</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={workers}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="userName" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="ordersCompleted" name="Заявок" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                        {workers.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {workers?.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {workers.map((worker: any, idx: number) => (
                    <div key={worker.userId} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: COLORS[idx % COLORS.length] }}>
                          {worker.userName?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800 text-sm">{worker.userName}</div>
                          <div className="text-xs text-gray-400">Працівник</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {[
                          { label: 'Виконано заявок', value: worker.ordersCompleted, color: 'text-gray-800' },
                          { label: 'Загальна вага', value: `${Number(worker.totalWeight || 0).toFixed(1)} кг`, color: 'text-blue-600' },
                          { label: 'Середній час', value: `${Number(worker.avgCompletionHours || 0).toFixed(1)} год`, color: 'text-purple-600' },
                        ].map(r => (
                          <div key={r.label} className="flex justify-between text-sm">
                            <span className="text-gray-500">{r.label}</span>
                            <span className={`font-medium ${r.color}`}>{r.value}</span>
                          </div>
                        ))}
                      </div>
                      {workers.length > 1 && (
                        <div className="mt-3">
                          <div className="text-xs text-gray-400 mb-1">Відносна продуктивність</div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full transition-all" style={{
                              width: `${(worker.ordersCompleted / Math.max(...workers.map((w: any) => w.ordersCompleted))) * 100}%`,
                              background: COLORS[idx % COLORS.length],
                            }} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-400 py-12 border-2 border-dashed border-gray-200 rounded-xl">Немає даних про працівників</div>
              )}
            </div>
          )}

          {/* ── ВИРОБНИЦТВО ── */}
          {activeTab === 'production' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Партій виробництва" value={production?.totalBatches || 0} color="purple" icon="⚙️" />
                <StatCard
                  label="Середній вихід"
                  value={production?.avgYield ? `${Number(production.avgYield).toFixed(1)}%` : '—'}
                  sub="сировина → готова продукція"
                  color={Number(production?.avgYield) >= 80 ? 'green' : Number(production?.avgYield) >= 60 ? 'orange' : 'red'}
                  icon="📊"
                />
                <StatCard
                  label="Середня собівартість"
                  value={production?.avgCostPerKg ? `${Number(production.avgCostPerKg).toFixed(2)} ₴/кг` : '—'}
                  color="blue"
                  icon="💰"
                />
                <StatCard label="Унікальних продуктів" value={production?.products?.length || 0} color="gray" icon="🐟" />
              </div>

              {production?.chart?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Динаміка виходу і собівартості</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={production.chart}>
                      <defs>
                        <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} unit="%" />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="₴" />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area yAxisId="left" type="monotone" dataKey="yield" name="Вихід %" stroke="#8b5cf6" fill="url(#colorYield)" strokeWidth={2} />
                      <Area yAxisId="right" type="monotone" dataKey="cost" name="Собів. ₴/кг" stroke="#f59e0b" fill="url(#colorCost)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {production?.products?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700">Аналіз по продуктах</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr className="text-left text-xs text-gray-500">
                        <th className="px-4 py-3 font-medium">Продукт</th>
                        <th className="px-4 py-3 font-medium text-right">Партій</th>
                        <th className="px-4 py-3 font-medium text-right">Вхід (кг)</th>
                        <th className="px-4 py-3 font-medium text-right">Вихід (кг)</th>
                        <th className="px-4 py-3 font-medium text-right">Вихід %</th>
                        <th className="px-4 py-3 font-medium text-right">Собів. ₴/кг</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {[...production.products]
                        .sort((a: any, b: any) => b.totalOutput - a.totalOutput)
                        .map((p: any, idx: number) => {
                          const yieldPct = Number(p.avgYield);
                          return (
                            <tr key={p.name} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: COLORS[idx % COLORS.length] }}>
                                    {idx + 1}
                                  </div>
                                  <span className="font-medium text-gray-800">{p.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right text-gray-600">{p.batches}</td>
                              <td className="px-4 py-3 text-right text-gray-600">{Number(p.totalInput).toFixed(1)}</td>
                              <td className="px-4 py-3 text-right font-medium text-gray-800">{Number(p.totalOutput).toFixed(1)}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                    <div className="h-1.5 rounded-full" style={{
                                      width: `${Math.min(yieldPct, 100)}%`,
                                      background: yieldPct >= 80 ? '#10b981' : yieldPct >= 60 ? '#f59e0b' : '#ef4444',
                                    }} />
                                  </div>
                                  <span className={`text-xs font-semibold ${yieldPct >= 80 ? 'text-green-600' : yieldPct >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
                                    {yieldPct.toFixed(1)}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-purple-700">{Number(p.avgCost).toFixed(2)} ₴</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              {(!production?.totalBatches || production.totalBatches === 0) && (
                <div className="text-center text-gray-400 py-16 border-2 border-dashed border-gray-200 rounded-2xl">
                  <div className="text-5xl mb-4">⚙️</div>
                  <div className="font-semibold text-gray-500">Немає виробничих партій за цей період</div>
                  <div className="text-sm mt-2 text-gray-400">Дані беруться з Калькулятора виробництва</div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}