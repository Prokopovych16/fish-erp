import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';

const MONTHS_UA = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];

const TYPE_CONFIG: Record<string, { label: string; sign: 1 | -1; icon: string; color: string }> = {
  INCOME:              { label: 'Дохід (готівка)',        sign:  1, icon: '💰', color: 'green' },
  EXPENSE:             { label: 'Витрата',                 sign: -1, icon: '💸', color: 'red' },
  SALARY_ME:           { label: 'Виділити зп Максиму',     sign: -1, icon: '👤', color: 'blue' },
  SALARY_PARTNER:      { label: 'Виділити зп Ользі',       sign: -1, icon: '👩', color: 'purple' },
  SALARY_ME_TAKE:      { label: 'Максим взяв зп',          sign: -1, icon: '💵', color: 'sky' },
  SALARY_PARTNER_TAKE: { label: 'Ольга взяла зп',          sign: -1, icon: '💵', color: 'fuchsia' },
  PRODUCTION_FUND:     { label: 'До виробн. фонду',        sign: -1, icon: '🏭', color: 'orange' },
  PRODUCTION_FUND_USE: { label: 'Витрата з вироб. фонду',  sign: -1, icon: '🔧', color: 'amber' },
};

const COLOR_CLS: Record<string, { bg: string; border: string; text: string; light: string }> = {
  green:   { bg: 'bg-green-50',   border: 'border-green-200',   text: 'text-green-700',   light: 'bg-green-100' },
  red:     { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-600',     light: 'bg-red-100' },
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    light: 'bg-blue-100' },
  purple:  { bg: 'bg-purple-50',  border: 'border-purple-200',  text: 'text-purple-700',  light: 'bg-purple-100' },
  sky:     { bg: 'bg-sky-50',     border: 'border-sky-200',     text: 'text-sky-700',     light: 'bg-sky-100' },
  fuchsia: { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', text: 'text-fuchsia-700', light: 'bg-fuchsia-100' },
  orange:  { bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700',  light: 'bg-orange-100' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   light: 'bg-amber-100' },
};

type Entry = { id: string; date: string; amount: string; type: string; note: string | null };
type Summary = {
  year: number; month: number;
  income: number; expense: number;
  salaryMe: number; salaryPartner: number;
  salaryMeTake: number; salaryPartnerTake: number;
  productionFund: number; productionFundUse: number;
  balance: number;
  cumulativeFund: number;
  cumulativeSalaryMe: number;
  cumulativeSalaryPartner: number;
  physicalCash: number;
};

function fmt(n: number) { return n.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtShort(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}к` : n.toFixed(0); }

// ─── Прогрес бар ─────────────────────────────────────────────────────────────
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const clr = color === 'blue' ? 'bg-blue-500' : 'bg-purple-500';
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
      <div className={`h-full ${clr} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Форма додавання/редагування ─────────────────────────────────────────────
function EntryModal({ entry, onClose, year, month, defaultType }: {
  entry?: Entry; onClose: () => void; year: number; month: number; defaultType?: string;
}) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(entry?.date.slice(0, 10) ?? `${year}-${String(month).padStart(2, '0')}-01`);
  const [amount, setAmount] = useState(entry ? String(Math.abs(Number(entry.amount))) : '');
  const [type, setType] = useState(entry?.type ?? defaultType ?? 'INCOME');
  const [note, setNote] = useState(entry?.note ?? '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!amount || !date) return;
    setLoading(true);
    try {
      const payload = { date, amount: Number(amount), type, note: note || undefined };
      if (entry) await api.patch(`/cash/${entry.id}`, payload);
      else await api.post('/cash', payload);
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      onClose();
    } finally { setLoading(false); }
  };

  const cfg = TYPE_CONFIG[type];
  const clr = COLOR_CLS[cfg?.color ?? 'blue'];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md">
        <div className="px-5 pt-5 pb-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">{entry ? 'Редагування' : 'Новий запис'}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{MONTHS_UA[month - 1]} {year}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Тип операції</label>
            <div className="grid grid-cols-2 gap-2">
              {(['INCOME', 'EXPENSE', 'PRODUCTION_FUND', 'PRODUCTION_FUND_USE'] as const).map((k) => {
                const v = TYPE_CONFIG[k];
                const c = COLOR_CLS[v.color];
                const active = type === k;
                return (
                  <button key={k} onClick={() => setType(k)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${active ? `${c.bg} ${c.border} ${c.text} font-bold` : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50 text-gray-500'}`}>
                    <span className="text-xl leading-none">{v.icon}</span>
                    <span className="text-xs font-semibold leading-tight">{v.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Сума, ₴&nbsp;
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${clr.light} ${clr.text}`}>{cfg?.sign === 1 ? 'дохід +' : 'витрата −'}</span>
              </label>
              <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" autoFocus
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Дата</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Примітка</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Необов'язково..."
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="px-5 pb-6 flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm py-3 rounded-xl hover:bg-gray-50 font-medium">Скасувати</button>
          <button onClick={handleSave} disabled={loading || !amount}
            className="flex-1 bg-blue-600 text-white text-sm py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-bold">
            {loading ? '...' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Форма виділення зарплат ──────────────────────────────────────────────────
function SalaryAllocModal({ onClose, year, month }: { onClose: () => void; year: number; month: number }) {
  const queryClient = useQueryClient();
  const defaultDate = `${year}-${String(month).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  const [date, setDate] = useState(defaultDate);
  const [maxim, setMaxim] = useState('');
  const [olga, setOlga] = useState('');
  const [loading, setLoading] = useState(false);
  const total = (Number(maxim) || 0) + (Number(olga) || 0);

  const handleSave = async () => {
    if (!maxim && !olga) return;
    setLoading(true);
    try {
      const reqs = [];
      if (Number(maxim) > 0) reqs.push(api.post('/cash', { date, amount: Number(maxim), type: 'SALARY_ME' }));
      if (Number(olga) > 0) reqs.push(api.post('/cash', { date, amount: Number(olga), type: 'SALARY_PARTNER' }));
      await Promise.all(reqs);
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      onClose();
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm">
        <div className="px-5 pt-5 pb-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">💼 Виділити зарплату</h2>
            <p className="text-xs text-gray-400 mt-0.5">Відкласти в сейф на зарплату · {MONTHS_UA[month - 1]} {year}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Дата</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
              <label className="block text-xs font-bold text-blue-600 mb-2">👤 Максим, ₴</label>
              <input type="number" min="0" step="0.01" value={maxim} onChange={e => setMaxim(e.target.value)}
                placeholder="0.00"
                className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-3">
              <label className="block text-xs font-bold text-purple-600 mb-2">👩 Ольга, ₴</label>
              <input type="number" min="0" step="0.01" value={olga} onChange={e => setOlga(e.target.value)}
                placeholder="0.00"
                className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 text-sm font-bold text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
          </div>
          {total > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex justify-between items-center text-sm">
              <span className="text-gray-600">Виділяється в сейф</span>
              <span className="font-bold text-blue-700">{fmt(total)} ₴</span>
            </div>
          )}
        </div>
        <div className="px-5 pb-6 flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm py-3 rounded-xl hover:bg-gray-50 font-medium">Скасувати</button>
          <button onClick={handleSave} disabled={loading || total === 0}
            className="flex-1 bg-blue-600 text-white text-sm py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-bold">
            {loading ? '...' : 'Виділити'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Форма: взяти зарплату ────────────────────────────────────────────────────
function TakeSalaryModal({ person, remaining, onClose, year, month }: {
  person: 'me' | 'partner'; remaining: number; onClose: () => void; year: number; month: number;
}) {
  const queryClient = useQueryClient();
  const defaultDate = `${year}-${String(month).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  const [date, setDate] = useState(defaultDate);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const type = person === 'me' ? 'SALARY_ME_TAKE' : 'SALARY_PARTNER_TAKE';
  const name = person === 'me' ? 'Максим' : 'Ольга';
  const color = person === 'me' ? 'blue' : 'purple';
  const clr = COLOR_CLS[color];
  const pct = remaining > 0 && Number(amount) > 0 ? Math.min(100, Math.round((Number(amount) / remaining) * 100)) : 0;

  const handleSave = async () => {
    if (!amount) return;
    setLoading(true);
    try {
      await api.post('/cash', { date, amount: Number(amount), type, note: note || undefined });
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      onClose();
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm">
        <div className={`px-5 pt-5 pb-4 border-b flex items-center justify-between`}>
          <div>
            <h2 className="font-bold text-gray-800 text-lg">💵 {name} бере зарплату</h2>
            <p className="text-xs text-gray-400 mt-0.5">Залишок: <span className={`font-bold ${clr.text}`}>{fmt(remaining)} ₴</span></p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Сума, ₴</label>
              <input type="number" min="0" max={remaining} step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" autoFocus
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Дата</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Примітка</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Необов'язково..."
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {Number(amount) > 0 && (
            <div className={`rounded-xl p-3 border ${clr.bg} ${clr.border}`}>
              <div className="flex justify-between text-sm mb-1">
                <span className={`${clr.text} font-medium`}>Залишиться після взяття</span>
                <span className={`font-bold ${clr.text}`}>{fmt(remaining - Number(amount))} ₴</span>
              </div>
              <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-white/50">
                <div className={`h-full ${color === 'blue' ? 'bg-blue-500' : 'bg-purple-500'} rounded-full transition-all`}
                  style={{ width: `${100 - pct}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className="px-5 pb-6 flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm py-3 rounded-xl hover:bg-gray-50 font-medium">Скасувати</button>
          <button onClick={handleSave} disabled={loading || !amount || Number(amount) > remaining}
            className="flex-1 bg-blue-600 text-white text-sm py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-bold">
            {loading ? '...' : 'Взяти'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Головна сторінка ─────────────────────────────────────────────────────────
type Tab = 'entries' | 'salary' | 'summaries' | 'stats';

const TABS: { key: Tab; label: string }[] = [
  { key: 'entries',   label: '📋 Записи' },
  { key: 'salary',    label: '💼 Зарплата' },
  { key: 'summaries', label: '📊 Зведення' },
  { key: 'stats',     label: '📈 Статистика' },
];

export default function CashPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<Tab>('entries');
  const [adding, setAdding] = useState(false);
  const [addingType, setAddingType] = useState<string | undefined>();
  const [allocSalary, setAllocSalary] = useState(false);
  const [takePerson, setTakePerson] = useState<'me' | 'partner' | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const queryClient = useQueryClient();

  const { data: entries = [] } = useQuery<Entry[]>({
    queryKey: ['cash', 'entries', year, month],
    queryFn: () => api.get('/cash', { params: { year, month } }).then(r => r.data),
  });

  const { data: summaries = [] } = useQuery<Summary[]>({
    queryKey: ['cash', 'summaries'],
    queryFn: () => api.get('/cash/summaries').then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/cash/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cash'] }),
  });

  const currentSummary = summaries.find(s => s.year === year && s.month === month);
  const lastSummary = summaries.length > 0 ? summaries[summaries.length - 1] : null;
  const latestFund = lastSummary?.cumulativeFund ?? 0;
  const totalSalaryMe = lastSummary?.cumulativeSalaryMe ?? 0;
  const totalSalaryPartner = lastSummary?.cumulativeSalaryPartner ?? 0;
  // physicalCash = реальні гроші в сейфі (INCOME - EXPENSE - SALARY_ME_TAKE - SALARY_PARTNER_TAKE - PRODUCTION_FUND_USE)
  // Виділення зарплати НЕ виходить з сейфу, тому не додаємо зарплатні пули — вони вже всередині physicalCash
  const physicalCash = lastSummary?.physicalCash ?? 0;
  const totalInSafe = physicalCash;
  const operationalFree = physicalCash - totalSalaryMe - totalSalaryPartner - latestFund;

  const goMonth = (dir: -1 | 1) => {
    const d = new Date(year, month - 1 + dir);
    setYear(d.getFullYear()); setMonth(d.getMonth() + 1);
  };

  const income = currentSummary?.income ?? 0;
  const expense = currentSummary?.expense ?? 0;
  const salaryMe = currentSummary?.salaryMe ?? 0;
  const salaryPartner = currentSummary?.salaryPartner ?? 0;
  const salaryMeTake = currentSummary?.salaryMeTake ?? 0;
  const salaryPartnerTake = currentSummary?.salaryPartnerTake ?? 0;
  const prodFund = currentSummary?.productionFund ?? 0;
  const prodFundUse = currentSummary?.productionFundUse ?? 0;
  const balance = income - expense - salaryMe - salaryPartner - prodFund;

  // Для таб Зарплата: загальна сума виділена за весь час (не тільки залишок)
  const totalAllocMe = summaries.reduce((s, x) => s + Number(x.salaryMe), 0);
  const totalAllocPartner = summaries.reduce((s, x) => s + Number(x.salaryPartner), 0);
  const totalTakenMe = summaries.reduce((s, x) => s + Number(x.salaryMeTake), 0);
  const totalTakenPartner = summaries.reduce((s, x) => s + Number(x.salaryPartnerTake), 0);

  // Статистика
  const totalIncome = summaries.reduce((s, x) => s + Number(x.income), 0);
  const totalExpense = summaries.reduce((s, x) => s + Number(x.expense), 0);

  return (
    <div className="space-y-4">

      {/* Заголовок */}
      <div className="bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 rounded-2xl sm:rounded-3xl border border-gray-100 p-3.5 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-lg sm:text-xl shadow-md shadow-emerald-200 shrink-0">💵</div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-800">Готівка</h1>
              <p className="text-xs text-gray-400 mt-0.5">Облік готівкових коштів</p>
            </div>
          </div>
          {/* Фізична готівка в сейфі */}
          <div className="flex gap-2">
            <div className="bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-gray-100 px-2.5 sm:px-4 py-2.5 sm:py-3 text-right">
              <div className="text-[10px] font-bold uppercase tracking-wide text-green-600">🏦 Всього в сейфі</div>
              <div className="text-base sm:text-lg font-bold leading-tight text-green-700">{fmt(totalInSafe)} ₴</div>
            </div>
            {latestFund > 0 && (
              <div className="bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-gray-100 px-2.5 sm:px-4 py-2.5 sm:py-3 text-right">
                <div className="text-[10px] font-bold uppercase tracking-wide text-orange-500">🏭 Вироб. фонд</div>
                <div className="text-base sm:text-lg font-bold leading-tight text-orange-600">{fmt(latestFund)} ₴</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm w-full sm:w-fit bg-white p-1 gap-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap text-xs sm:text-sm ${tab === t.key ? 'bg-gray-900 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Вкладка: Записи ──────────────────────────────────────────────────── */}
      {tab === 'entries' && (
        <div className="space-y-4">
          {/* Місяць навігація */}
          <div className="flex items-center gap-3">
            <button onClick={() => goMonth(-1)} className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-600 text-lg font-bold">‹</button>
            <span className="text-sm font-bold text-gray-800">{MONTHS_UA[month - 1]} {year}</span>
            <button onClick={() => goMonth(1)} className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-600 text-lg font-bold">›</button>
          </div>

          {/* Підсумок місяця */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b bg-gray-50">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Підсумок {MONTHS_UA[month - 1]} {year}</span>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between py-1 border-b border-dashed border-gray-100">
                <span className="text-sm text-gray-600 flex items-center gap-2">💰 Дохід</span>
                <span className="font-bold text-green-600">+{fmt(income)} ₴</span>
              </div>
              {expense > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">💸 Витрати</span>
                  <span className="text-red-500 font-medium">−{fmt(expense)} ₴</span>
                </div>
              )}
              {salaryMe > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">👤 Виділено Максиму</span>
                  <span className="text-blue-600 font-medium">−{fmt(salaryMe)} ₴</span>
                </div>
              )}
              {salaryMeTake > 0 && (
                <div className="flex items-center justify-between text-sm pl-5">
                  <span className="text-gray-400 text-xs">↳ Максим взяв</span>
                  <span className="text-sky-600 font-medium text-xs">−{fmt(salaryMeTake)} ₴</span>
                </div>
              )}
              {salaryPartner > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">👩 Виділено Ользі</span>
                  <span className="text-purple-600 font-medium">−{fmt(salaryPartner)} ₴</span>
                </div>
              )}
              {salaryPartnerTake > 0 && (
                <div className="flex items-center justify-between text-sm pl-5">
                  <span className="text-gray-400 text-xs">↳ Ольга взяла</span>
                  <span className="text-fuchsia-600 font-medium text-xs">−{fmt(salaryPartnerTake)} ₴</span>
                </div>
              )}
              {prodFund > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">🏭 До виробн. фонду</span>
                  <span className="text-orange-500 font-medium">−{fmt(prodFund)} ₴</span>
                </div>
              )}
              {prodFundUse > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">🔧 Витрата з фонду</span>
                  <span className="text-amber-600 font-medium">−{fmt(prodFundUse)} ₴</span>
                </div>
              )}
              <div className={`flex items-center justify-between pt-2 border-t-2 ${balance >= 0 ? 'border-green-200' : 'border-red-200'}`}>
                <span className="text-sm font-bold text-gray-700">Операційний залишок</span>
                <span className={`font-bold text-lg ${balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {balance >= 0 ? '+' : ''}{fmt(balance)} ₴
                </span>
              </div>
            </div>
          </div>

          {/* Список записів */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700">Записи місяця</span>
              <button onClick={() => { setAdding(true); setAddingType(undefined); }}
                className="bg-gray-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors shadow-sm">
                + Додати
              </button>
            </div>
            {entries.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <div className="text-3xl mb-2">📭</div>
                <div className="text-gray-400 text-sm">Записів немає. Додайте перший запис.</div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {entries.map(e => {
                  const cfg = TYPE_CONFIG[e.type];
                  const clr = COLOR_CLS[cfg?.color ?? 'blue'];
                  const amt = Number(e.amount);
                  return (
                    <div key={e.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50/60 transition-colors group">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 border ${clr.bg} ${clr.border}`}>
                        {cfg?.icon ?? '📝'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-800">{cfg?.label ?? e.type}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {new Date(e.date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}
                        </div>
                        {e.note && (
                          <div className="flex items-start gap-1.5 mt-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 max-w-full">
                            <span className="text-gray-300 text-base leading-none shrink-0">"</span>
                            <span className="text-sm text-gray-600 truncate">{e.note}</span>
                          </div>
                        )}
                      </div>
                      <span className={`font-bold text-sm shrink-0 ${cfg?.sign === 1 ? 'text-green-600' : 'text-red-500'}`}>
                        {cfg?.sign === 1 ? '+' : '−'}{fmt(amt)} ₴
                      </span>
                      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity">
                        <button onClick={() => setEditing(e)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 text-xs">✏️</button>
                        <button onClick={() => { if (confirm('Видалити?')) deleteMutation.mutate(e.id); }}
                          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 text-xs">🗑</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Вкладка: Зарплата ────────────────────────────────────────────────── */}
      {tab === 'salary' && (
        <div className="space-y-4">
          {/* Картки залишку зарплат */}
          <div className="grid grid-cols-2 gap-3">
            {/* Максим */}
            <div className="bg-white border border-blue-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-lg">👤</div>
                <div>
                  <div className="text-sm font-bold text-gray-800">Максим</div>
                  <div className="text-[10px] text-gray-400">залишок зарплати</div>
                </div>
              </div>
              <div className="text-2xl font-bold text-blue-700">{fmt(totalSalaryMe)} ₴</div>
              <ProgressBar value={totalTakenMe} max={totalAllocMe} color="blue" />
              <div className="mt-2 flex justify-between text-[10px] text-gray-400">
                <span>Взято: {fmt(totalTakenMe)} ₴</span>
                <span>Виділено: {fmt(totalAllocMe)} ₴</span>
              </div>
              <button onClick={() => setTakePerson('me')}
                disabled={totalSalaryMe <= 0}
                className="mt-3 w-full bg-blue-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors">
                💵 Взяти зарплату
              </button>
            </div>
            {/* Ольга */}
            <div className="bg-white border border-purple-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-lg">👩</div>
                <div>
                  <div className="text-sm font-bold text-gray-800">Ольга</div>
                  <div className="text-[10px] text-gray-400">залишок зарплати</div>
                </div>
              </div>
              <div className="text-2xl font-bold text-purple-700">{fmt(totalSalaryPartner)} ₴</div>
              <ProgressBar value={totalTakenPartner} max={totalAllocPartner} color="purple" />
              <div className="mt-2 flex justify-between text-[10px] text-gray-400">
                <span>Взято: {fmt(totalTakenPartner)} ₴</span>
                <span>Виділено: {fmt(totalAllocPartner)} ₴</span>
              </div>
              <button onClick={() => setTakePerson('partner')}
                disabled={totalSalaryPartner <= 0}
                className="mt-3 w-full bg-purple-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-purple-700 disabled:opacity-40 transition-colors">
                💵 Взяти зарплату
              </button>
            </div>
          </div>

          {/* Кнопка виділити */}
          <button onClick={() => setAllocSalary(true)}
            className="w-full bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 text-blue-700 text-sm font-bold py-3 rounded-2xl hover:shadow-md transition-all flex items-center justify-center gap-2">
            <span>💼</span> Виділити зарплату на місяць
          </button>

          {/* Готівка в сейфі (розбивка) */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">🏦 Фактична готівка в сейфі</div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Вільна каса</span>
                <span className={`font-semibold ${operationalFree >= 0 ? 'text-gray-800' : 'text-red-500'}`}>{fmt(operationalFree)} ₴</span>
              </div>
              {totalSalaryMe > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">👤 Зп Максима (відкладено)</span>
                  <span className="font-semibold text-blue-600">{fmt(totalSalaryMe)} ₴</span>
                </div>
              )}
              {totalSalaryPartner > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">👩 Зп Ольги (відкладено)</span>
                  <span className="font-semibold text-purple-600">{fmt(totalSalaryPartner)} ₴</span>
                </div>
              )}
              {latestFund > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">🏭 Виробничий фонд</span>
                  <span className="font-semibold text-orange-600">{fmt(latestFund)} ₴</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t-2 border-green-200">
                <span className="text-sm font-bold text-gray-700">Разом в сейфі</span>
                <span className="font-bold text-lg text-green-700">{fmt(totalInSafe)} ₴</span>
              </div>
            </div>
          </div>

          {/* Історія виплат і виділень */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b bg-gray-50">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Історія по місяцях</span>
            </div>
            <div className="divide-y divide-gray-100">
              {summaries.length === 0 && (
                <div className="px-5 py-8 text-center text-gray-400 text-sm">Даних ще немає</div>
              )}
              {[...summaries].reverse().filter(s => Number(s.salaryMe) > 0 || Number(s.salaryPartner) > 0 || Number(s.salaryMeTake) > 0 || Number(s.salaryPartnerTake) > 0).map(s => (
                <div key={`${s.year}-${s.month}`} className="px-4 py-3">
                  <div className="text-xs font-bold text-gray-600 mb-2">{MONTHS_UA[s.month - 1]} {s.year}</div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                    {Number(s.salaryMe) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">👤 Виділено Максиму</span>
                        <span className="font-medium text-blue-600">+{fmt(Number(s.salaryMe))}</span>
                      </div>
                    )}
                    {Number(s.salaryMeTake) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">💵 Максим взяв</span>
                        <span className="font-medium text-sky-600">−{fmt(Number(s.salaryMeTake))}</span>
                      </div>
                    )}
                    {Number(s.salaryPartner) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">👩 Виділено Ользі</span>
                        <span className="font-medium text-purple-600">+{fmt(Number(s.salaryPartner))}</span>
                      </div>
                    )}
                    {Number(s.salaryPartnerTake) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">💵 Ольга взяла</span>
                        <span className="font-medium text-fuchsia-600">−{fmt(Number(s.salaryPartnerTake))}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Вкладка: Зведення ───────────────────────────────────────────────── */}
      {tab === 'summaries' && (
        <div className="space-y-3">
          {summaries.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl px-5 py-12 text-center text-gray-400 text-sm shadow-sm">Даних ще немає</div>
          ) : (
            [...summaries].reverse().map(s => {
              const sal = Number(s.salaryMe) + Number(s.salaryPartner);
              const isActive = s.year === year && s.month === month;
              const bal = Number(s.balance);
              return (
                <button key={`${s.year}-${s.month}`}
                  onClick={() => { setYear(s.year); setMonth(s.month); setTab('entries'); }}
                  className={`w-full text-left rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all ${isActive ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-white hover:bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-800">{MONTHS_UA[s.month - 1]} {s.year}</span>
                      {isActive && <span className="text-[10px] bg-blue-200 text-blue-700 font-bold px-2 py-0.5 rounded-full">поточний</span>}
                    </div>
                    <span className={`text-sm font-bold ${bal >= 0 ? 'text-green-600' : 'text-red-500'}`}>{bal >= 0 ? '+' : ''}{fmt(bal)} ₴</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><span className="text-gray-400">💰 Дохід</span><br/><span className="font-semibold text-green-600">+{fmt(Number(s.income))}</span></div>
                    <div><span className="text-gray-400">💸 Витрати</span><br/><span className="font-semibold text-red-500">−{fmt(Number(s.expense))}</span></div>
                    <div><span className="text-gray-400">👥 Зарплати</span><br/><span className="font-semibold text-purple-600">−{fmt(sal)}</span></div>
                  </div>
                  {Number(s.physicalCash) !== 0 && (
                    <div className="mt-2 text-[11px] text-green-700 font-medium">🏦 Готівка в сейфі (наростаючим): {fmt(Number(s.physicalCash))} ₴</div>
                  )}
                  {Number(s.cumulativeFund) > 0 && (
                    <div className="mt-0.5 text-[11px] text-orange-600 font-medium">🏭 Фонд: {fmt(Number(s.cumulativeFund))} ₴</div>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}

      {/* ── Вкладка: Статистика ──────────────────────────────────────────────── */}
      {tab === 'stats' && (
        <div className="space-y-4">
          {summaries.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl px-5 py-12 text-center text-gray-400 text-sm shadow-sm">Недостатньо даних</div>
          ) : (() => {
            const totalTurnover = totalIncome + totalExpense;
            const avgIncome = summaries.length > 0 ? totalIncome / summaries.length : 0;
            const avgExpense = summaries.length > 0 ? totalExpense / summaries.length : 0;
            const maxBar = Math.max(...summaries.map(s => Number(s.income)), ...summaries.map(s => Number(s.expense)), 1);

            return (
              <>
                {/* Загальний оборот */}
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Загальний оборот готівки</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-xl p-3">
                      <div className="text-[10px] text-green-600 font-bold uppercase mb-1">💰 Всього дохід</div>
                      <div className="text-lg font-bold text-green-700">{fmt(totalIncome)}</div>
                      <div className="text-[10px] text-green-400 mt-0.5">∅ {fmt(avgIncome)}/міс</div>
                    </div>
                    <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-100 rounded-xl p-3">
                      <div className="text-[10px] text-red-500 font-bold uppercase mb-1">💸 Всього витрати</div>
                      <div className="text-lg font-bold text-red-600">{fmt(totalExpense)}</div>
                      <div className="text-[10px] text-red-400 mt-0.5">∅ {fmt(avgExpense)}/міс</div>
                    </div>
                    <div className="bg-gradient-to-br from-slate-50 to-gray-100 border border-gray-100 rounded-xl p-3">
                      <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">🔄 Оборот</div>
                      <div className="text-lg font-bold text-gray-700">{fmt(totalTurnover)}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{summaries.length} міс.</div>
                    </div>
                  </div>
                </div>

                {/* Таблиця по місяцях */}
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b bg-gray-50">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Оборот по місяцях</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {[...summaries].reverse().map(s => {
                      const inc = Number(s.income);
                      const exp = Number(s.expense);
                      const sal = Number(s.salaryMe) + Number(s.salaryPartner);
                      const turnover = inc + exp;
                      const incPct = maxBar > 0 ? Math.round((inc / maxBar) * 100) : 0;
                      const expPct = maxBar > 0 ? Math.round((exp / maxBar) * 100) : 0;
                      const isActive = s.year === year && s.month === month;
                      return (
                        <button key={`${s.year}-${s.month}`}
                          onClick={() => { setYear(s.year); setMonth(s.month); setTab('entries'); }}
                          className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${isActive ? 'bg-blue-50' : ''}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-gray-800">{MONTHS_UA[s.month - 1]} {s.year}</span>
                              {isActive && <span className="text-[10px] bg-blue-200 text-blue-700 font-bold px-1.5 py-0.5 rounded-full">поточний</span>}
                            </div>
                            <span className="text-xs text-gray-400">оборот: <span className="font-semibold text-gray-600">{fmt(turnover)} ₴</span></span>
                          </div>
                          {/* Дохід бар */}
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] text-gray-400 w-12 shrink-0">💰 дохід</span>
                            <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                              <div className="h-full bg-green-400 rounded flex items-center justify-end pr-1.5 transition-all" style={{ width: `${Math.max(incPct, 1)}%` }}>
                                {incPct > 25 && <span className="text-[9px] font-bold text-white">{fmtShort(inc)}</span>}
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold text-green-600 w-16 text-right shrink-0">{fmt(inc)} ₴</span>
                          </div>
                          {/* Витрати бар */}
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] text-gray-400 w-12 shrink-0">💸 витрати</span>
                            <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                              <div className="h-full bg-red-400 rounded flex items-center justify-end pr-1.5 transition-all" style={{ width: `${Math.max(expPct, 1)}%` }}>
                                {expPct > 25 && <span className="text-[9px] font-bold text-white">{fmtShort(exp)}</span>}
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold text-red-500 w-16 text-right shrink-0">{fmt(exp)} ₴</span>
                          </div>
                          {/* Зарплати бар */}
                          {sal > 0 && (() => {
                            const salPct = maxBar > 0 ? Math.round((sal / maxBar) * 100) : 0;
                            return (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400 w-12 shrink-0">👥 зарплати</span>
                                <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                                  <div className="h-full bg-purple-400 rounded flex items-center justify-end pr-1.5 transition-all" style={{ width: `${Math.max(salPct, 1)}%` }}>
                                    {salPct > 25 && <span className="text-[9px] font-bold text-white">{fmtShort(sal)}</span>}
                                  </div>
                                </div>
                                <span className="text-[10px] font-semibold text-purple-600 w-16 text-right shrink-0">{fmt(sal)} ₴</span>
                              </div>
                            );
                          })()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Модалки */}
      {(adding || editing) && (
        <EntryModal entry={editing ?? undefined} year={year} month={month} defaultType={addingType}
          onClose={() => { setAdding(false); setEditing(null); setAddingType(undefined); }}
        />
      )}
      {allocSalary && <SalaryAllocModal year={year} month={month} onClose={() => setAllocSalary(false)} />}
      {takePerson && (
        <TakeSalaryModal
          person={takePerson}
          remaining={takePerson === 'me' ? totalSalaryMe : totalSalaryPartner}
          year={year} month={month}
          onClose={() => setTakePerson(null)}
        />
      )}
    </div>
  );
}
