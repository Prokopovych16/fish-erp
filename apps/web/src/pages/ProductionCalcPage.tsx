import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';

type CalcOutput = {
  id: string;
  productName: string;
  quantity: number;
  costPerKg: number;
  markupPct: number | null;
  salePricePerKg: number | null;
  margin: number | null;
  form: string;
};

type CalcInput = {
  id: string;
  productName: string;
  quantity: number;
  pricePerKg: number;
  totalCost: number;
  form: string;
  supplierName: string | null;
};

type ProductionCalc = {
  id: string;
  createdAt: string;
  note: string | null;
  totalInputCost: number;
  totalOutputQty: number;
  costPerKg: number;
  inputs: CalcInput[];
  outputs: CalcOutput[];
};

// ─── Рядок готової продукції з ціноутворенням ────────────────────────────────
function OutputRow({ output, costPerKg }: { output: CalcOutput; costPerKg: number }) {
  const queryClient = useQueryClient();
  const [markup, setMarkup] = useState(output.markupPct != null ? String(output.markupPct) : '');
  const [saving, setSaving] = useState(false);

  const markupNum = Number(markup) || 0;
  const salePrice = costPerKg * (1 + markupNum / 100);
  const marginPerKg = salePrice - costPerKg;
  const marginTotal = marginPerKg * Number(output.quantity);
  const marginPct = costPerKg > 0 ? (marginPerKg / costPerKg) * 100 : 0;
  const isDirty = String(output.markupPct ?? '') !== markup;

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/production-calc/output/${output.id}/markup`, { markupPct: markupNum });
      queryClient.invalidateQueries({ queryKey: ['production-calc'] });
    } finally {
      setSaving(false);
    }
  };

  const marginColor = marginPct >= 20 ? 'text-green-600' : marginPct >= 10 ? 'text-yellow-600' : 'text-red-500';
  const marginBg = marginPct >= 20 ? 'bg-green-50 border-green-200' : marginPct >= 10 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/40 p-3.5 space-y-3">
      {/* Назва продукту */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-base shrink-0">🐟</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold shrink-0 ${
              output.form === 'FORM_1' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
            }`}>
              {output.form === 'FORM_1' ? 'Ф1' : 'Ф2'}
            </span>
            <span className="font-bold text-gray-800 text-sm truncate">{output.productName}</span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {Number(output.quantity).toFixed(3)} кг · собівартість {costPerKg.toFixed(2)} ₴/кг
          </div>
        </div>
      </div>

      {/* Метрики + дія */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-stretch">
        {/* Націнка % */}
        <div className="bg-white border border-gray-200 rounded-xl px-2.5 py-2">
          <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Націнка</div>
          <div className="flex items-center gap-1">
            <input
              type="number" step="0.1" min="0"
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && isDirty && handleSave()}
              placeholder="0"
              className="w-full min-w-0 focus:outline-none text-sm text-right font-bold text-gray-800"
            />
            <span className="text-xs text-gray-400 shrink-0">%</span>
          </div>
        </div>

        {/* Ціна продажу */}
        <div className="bg-purple-50 border border-purple-100 rounded-xl px-2.5 py-2 text-center">
          <div className="text-[10px] text-purple-400 font-semibold uppercase tracking-wide mb-1">Ціна/кг</div>
          <div className="font-bold text-purple-700 text-sm">{salePrice.toFixed(2)} ₴</div>
        </div>

        {/* Маржа */}
        <div className={`rounded-xl border px-2.5 py-2 text-center ${marginBg}`}>
          <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Маржа %</div>
          <div className={`font-bold text-sm ${marginColor}`}>{marginPct.toFixed(1)}% <span className="text-[10px] font-normal text-gray-400">({marginPerKg.toFixed(2)}₴)</span></div>
        </div>

        {/* Загальна маржа або кнопка зберегти */}
        {isDirty ? (
          <button onClick={handleSave} disabled={saving}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs px-2 py-2 rounded-xl hover:opacity-90 disabled:opacity-50 transition-all font-bold shadow-sm">
            {saving ? '...' : '✓ Зберегти'}
          </button>
        ) : (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-2.5 py-2 text-center">
            <div className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wide mb-1">Маржа загалом</div>
            <div className={`font-bold text-sm ${marginColor}`}>{marginTotal.toFixed(2)} ₴</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Картка партії ────────────────────────────────────────────────────────────
function CalcCard({ calc, onDelete }: { calc: ProductionCalc; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  const costPerKg = Number(calc.costPerKg);
  const totalInputCost = Number(calc.totalInputCost);
  const totalOutputQty = Number(calc.totalOutputQty);
  const totalInputQty = calc.inputs.reduce((s, i) => s + Number(i.quantity), 0);
  const yieldPct = totalInputQty > 0 ? (totalOutputQty / totalInputQty) * 100 : 0;

  const totalMargin = calc.outputs.reduce((s, o) => {
    if (!o.markupPct) return s;
    const sale = costPerKg * (1 + Number(o.markupPct) / 100);
    return s + (sale - costPerKg) * Number(o.quantity);
  }, 0);
  const hasMarkups = calc.outputs.some((o) => o.markupPct != null && Number(o.markupPct) > 0);

  const date = new Date(calc.createdAt).toLocaleDateString('uk-UA', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const yieldColorExpanded = yieldPct >= 80 ? 'text-green-300' : yieldPct >= 60 ? 'text-yellow-300' : 'text-red-300';
  const yieldColorCollapsed = yieldPct >= 80 ? 'text-green-600' : yieldPct >= 60 ? 'text-yellow-600' : 'text-red-500';

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden shadow-sm transition-all ${
      expanded ? 'border-purple-200 shadow-md' : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
    }`}>
      {/* Шапка */}
      <div
        onClick={() => setExpanded(!expanded)}
        className={`px-4 sm:px-5 py-3.5 sm:py-4 cursor-pointer transition-colors flex items-center justify-between gap-3 sm:gap-4 ${
          expanded ? 'bg-gradient-to-r from-purple-600 to-indigo-600' : 'bg-gray-50/70 hover:bg-gray-100/70'
        }`}
      >
        {/* Ліва частина: дата + теги */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap min-w-0">
          <div className="shrink-0 flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${expanded ? 'bg-white/20' : 'bg-white border border-gray-200'}`}>⚙️</div>
            <div>
              <div className={`font-bold text-sm ${expanded ? 'text-white' : 'text-gray-800'}`}>{date}</div>
              {calc.note && (
                <div className={`text-xs mt-0.5 truncate max-w-[160px] ${expanded ? 'text-purple-200' : 'text-gray-400'}`}>{calc.note}</div>
              )}
            </div>
          </div>
          <div className="hidden md:flex items-center gap-1.5 flex-wrap">
            {calc.inputs.map((inp) => (
              <span key={inp.id} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                expanded ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                {inp.productName} {Number(inp.quantity).toFixed(1)} кг{inp.supplierName ? ` · ${inp.supplierName}` : ''}
              </span>
            ))}
            <span className={`text-xs ${expanded ? 'text-purple-200' : 'text-gray-300'}`}>→</span>
            {calc.outputs.map((out) => (
              <span key={out.id} className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                expanded ? 'bg-white/25 text-white' : 'bg-purple-50 text-purple-700'
              }`}>
                {out.productName} {Number(out.quantity).toFixed(1)} кг
              </span>
            ))}
          </div>
        </div>

        {/* Права частина: статистика */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-center">
              <div className={`text-[10px] font-semibold uppercase tracking-wide ${expanded ? 'text-purple-200' : 'text-gray-400'}`}>Собівартість</div>
              <div className={`font-bold text-sm ${expanded ? 'text-white' : 'text-purple-700'}`}>{costPerKg.toFixed(2)} ₴/кг</div>
            </div>
            <div className={`w-px h-7 ${expanded ? 'bg-white/20' : 'bg-gray-200'}`} />
            <div className="text-center">
              <div className={`text-[10px] font-semibold uppercase tracking-wide ${expanded ? 'text-purple-200' : 'text-gray-400'}`}>Вихід</div>
              <div className={`font-bold text-sm ${expanded ? yieldColorExpanded : yieldColorCollapsed}`}>
                {yieldPct.toFixed(1)}%
              </div>
            </div>
            {hasMarkups && (
              <>
                <div className={`w-px h-7 ${expanded ? 'bg-white/20' : 'bg-gray-200'}`} />
                <div className="text-center">
                  <div className={`text-[10px] font-semibold uppercase tracking-wide ${expanded ? 'text-purple-200' : 'text-gray-400'}`}>Маржа</div>
                  <div className={`font-bold text-sm ${expanded ? 'text-emerald-300' : 'text-emerald-600'}`}>
                    {totalMargin.toFixed(2)} ₴
                  </div>
                </div>
              </>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(calc.id); }}
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors ${expanded ? 'text-purple-200 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}>
            🗑
          </button>
          <span className={`text-base transition-transform duration-200 inline-block ${expanded ? 'rotate-180' : ''} ${expanded ? 'text-white' : 'text-gray-400'}`}>
            ↓
          </span>
        </div>
      </div>

      {/* Теги на мобільних — окремим рядком */}
      <div className={`md:hidden flex items-center gap-1.5 flex-wrap px-4 py-2.5 ${expanded ? 'bg-purple-700/90' : 'bg-gray-50/40 border-t border-gray-100'}`}>
        {calc.inputs.map((inp) => (
          <span key={inp.id} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${expanded ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {inp.productName} {Number(inp.quantity).toFixed(1)} кг
          </span>
        ))}
        <span className={`text-[11px] ${expanded ? 'text-purple-200' : 'text-gray-300'}`}>→</span>
        {calc.outputs.map((out) => (
          <span key={out.id} className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${expanded ? 'bg-white/25 text-white' : 'bg-purple-50 text-purple-700'}`}>
            {out.productName} {Number(out.quantity).toFixed(1)} кг
          </span>
        ))}
      </div>

      {/* Розгорнутий вміст */}
      {expanded && (
        <div className="p-4 sm:p-5 space-y-5 bg-gray-50/30">

          {/* Таблиця сировини */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="w-7 h-7 rounded-xl bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold shrink-0">↑</span>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Сировина · Витрати</span>
            </div>
            <div className="bg-white border border-red-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] text-gray-400 uppercase tracking-wide bg-red-50/60 border-b border-red-100">
                      <th className="px-3.5 py-2.5 text-left font-bold">Продукт</th>
                      <th className="px-3.5 py-2.5 text-left font-bold">Постачальник</th>
                      <th className="px-3.5 py-2.5 text-right font-bold">Кількість</th>
                      <th className="px-3.5 py-2.5 text-right font-bold">Ціна/кг</th>
                      <th className="px-3.5 py-2.5 text-right font-bold">Вартість</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {calc.inputs.map((inp) => (
                      <tr key={inp.id} className="hover:bg-red-50/30 transition-colors">
                        {/* Продукт */}
                        <td className="px-3.5 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold shrink-0 ${
                              inp.form === 'FORM_1' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                            }`}>
                              {inp.form === 'FORM_1' ? 'Ф1' : 'Ф2'}
                            </span>
                            <span className="font-semibold text-gray-700">{inp.productName}</span>
                          </div>
                        </td>
                        {/* Постачальник */}
                        <td className="px-3.5 py-3">
                          {inp.supplierName
                            ? <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-lg text-xs font-medium">{inp.supplierName}</span>
                            : <span className="text-gray-300 text-xs">—</span>
                          }
                        </td>
                        {/* Кількість */}
                        <td className="px-3.5 py-3 text-right font-semibold text-gray-700">
                          {Number(inp.quantity).toFixed(3)} кг
                        </td>
                        {/* Ціна/кг */}
                        <td className="px-3.5 py-3 text-right text-gray-500">
                          {Number(inp.pricePerKg).toFixed(2)} ₴
                        </td>
                        {/* Вартість */}
                        <td className="px-3.5 py-3 text-right font-bold text-red-600">
                          {Number(inp.totalCost).toFixed(2)} ₴
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-red-100 bg-red-50/60">
                      <td className="px-3.5 py-2.5 font-bold text-gray-700" colSpan={4}>Всього витрат</td>
                      <td className="px-3.5 py-2.5 text-right font-bold text-red-700">{totalInputCost.toFixed(2)} ₴</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Зведення про вихід */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-white border border-gray-100 rounded-xl px-3 py-2.5 text-center shadow-sm">
              <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Сировина</div>
              <div className="font-bold text-gray-800 text-sm">{totalInputQty.toFixed(2)} кг</div>
            </div>
            <div className={`bg-white border rounded-xl px-3 py-2.5 text-center shadow-sm ${yieldPct >= 80 ? 'border-emerald-100' : 'border-orange-100'}`}>
              <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Вихід</div>
              <div className={`font-bold text-sm ${yieldPct >= 80 ? 'text-emerald-600' : 'text-orange-500'}`}>{yieldPct.toFixed(1)}%</div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl px-3 py-2.5 text-center shadow-sm">
              <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Готової</div>
              <div className="font-bold text-gray-800 text-sm">{totalOutputQty.toFixed(2)} кг</div>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2.5 text-center shadow-sm">
              <div className="text-[10px] text-purple-400 font-semibold uppercase tracking-wide mb-0.5">Собівартість</div>
              <div className="font-bold text-purple-700 text-sm">{costPerKg.toFixed(2)} ₴/кг</div>
            </div>
          </div>

          {/* Готова продукція · Ціноутворення */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold shrink-0">↓</span>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Готова продукція · Ціноутворення</span>
            </div>
            <div className="space-y-2.5">
              {calc.outputs.map((output) => (
                <OutputRow key={output.id} output={output} costPerKg={costPerKg} />
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ─── ProductionCalcPage ───────────────────────────────────────────────────────
export default function ProductionCalcPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'calcs' | 'ai'>('calcs');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { data: calcs = [], isLoading } = useQuery({
    queryKey: ['production-calc'],
    queryFn: () => api.get('/production-calc').then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/production-calc/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['production-calc'] }),
  });

  const handleDelete = (id: string) => {
    if (confirm('Видалити цей розрахунок?')) deleteMutation.mutate(id);
  };

  const filtered = useMemo(() => {
    return (calcs as ProductionCalc[]).filter((c) => {
      if (search) {
        const q = search.toLowerCase();
        const inInputs = c.inputs.some((i) =>
          i.productName.toLowerCase().includes(q) ||
          (i.supplierName?.toLowerCase().includes(q) ?? false)
        );
        const inOutputs = c.outputs.some((o) => o.productName.toLowerCase().includes(q));
        const inNote = c.note?.toLowerCase().includes(q);
        if (!inInputs && !inOutputs && !inNote) return false;
      }
      if (dateFrom && new Date(c.createdAt) < new Date(dateFrom)) return false;
      if (dateTo && new Date(c.createdAt) > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [calcs, search, dateFrom, dateTo]);

  const hasFilters = !!(search || dateFrom || dateTo);
  const resetFilters = () => { setSearch(''); setDateFrom(''); setDateTo(''); };

const stats = useMemo(() => {
  if (!filtered.length) return null;

  const withYield = filtered.map((c) => {
    const inQty = c.inputs.reduce((s, i) => s + Number(i.quantity), 0);
    const outQty = Number(c.totalOutputQty);
    const pct = inQty > 0 ? outQty / inQty * 100 : 0;
    // Назва: перший вхід → перший вихід
    const name = `${c.inputs[0]?.productName ?? '?'} → ${c.outputs[0]?.productName ?? '?'}`;
    return { pct, name };
  });

  const bestYield = withYield.reduce((best, cur) => cur.pct > best.pct ? cur : best, withYield[0]);
  const worstYield = withYield.reduce((worst, cur) => cur.pct < worst.pct ? cur : worst, withYield[0]);

  const withoutMarkup = filtered.filter((c) =>
    c.outputs.some((o) => !o.markupPct)
  ).length;

  return { count: filtered.length, bestYield, worstYield, withoutMarkup };
}, [filtered]);

  return (
    <div className="space-y-5">
      {/* Шапка-дашборд */}
      <div className="bg-gradient-to-br from-slate-50 via-white to-purple-50/40 rounded-2xl sm:rounded-3xl border border-gray-100 p-3.5 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-lg sm:text-xl shadow-md shadow-purple-200 shrink-0">💎</div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-800 tracking-tight">Калькулятор виробництва</h1>
              <p className="text-xs sm:text-sm text-gray-400">Собівартість · Ціноутворення · Маржа</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm bg-white shadow-sm">
              <button onClick={() => setActiveTab('calcs')}
                className={`px-3 py-2 font-medium transition-colors ${activeTab === 'calcs' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                📋 Розрахунки
              </button>
              <button onClick={() => setActiveTab('ai')}
                className={`px-3 py-2 font-medium transition-colors ${activeTab === 'ai' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                🤖 AI Ціни
              </button>
            </div>
            {activeTab === 'calcs' && (
              <button onClick={() => setShowFilters(v => !v)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all ${showFilters || hasFilters ? 'bg-gray-900 text-white border-gray-900 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                🔍 Фільтри
                {hasFilters && <span className="bg-white text-gray-900 text-xs px-1.5 py-0.5 rounded-full font-bold">{[search, dateFrom, dateTo].filter(Boolean).length}</span>}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* AI вкладка */}
      {activeTab === 'ai' && <AiPricingTab calcs={calcs as ProductionCalc[]} />}

      {/* Все нижче — тільки для вкладки Розрахунки */}
      {activeTab === 'calcs' && showFilters && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1.5">
                Пошук по продукту або постачальнику
              </label>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Назва..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1.5">Від</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1.5">До</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
          </div>
          {hasFilters && (
            <button onClick={resetFilters} className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
              × Скинути фільтри
            </button>
          )}
        </div>
      )}

{/* Статистика */}
{stats && (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {/* Партій */}
    <div className="bg-white border border-gray-100 shadow-sm rounded-2xl px-4 py-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-base shrink-0">📦</div>
      <div className="min-w-0">
        <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Партій</div>
        <div className="font-bold text-lg text-gray-800 leading-tight">{stats.count}</div>
      </div>
    </div>

    {/* Найкращий вихід */}
    <div className="bg-white border border-emerald-100 shadow-sm rounded-2xl px-4 py-3">
      <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">🏆 Найкращий вихід</div>
      <div className="font-bold text-lg text-emerald-600">{stats.bestYield.pct.toFixed(1)}%</div>
      <div className="text-[10px] text-gray-400 mt-0.5 truncate">{stats.bestYield.name}</div>
    </div>

    {/* Найгірший вихід */}
    <div className="bg-white border border-red-100 shadow-sm rounded-2xl px-4 py-3">
      <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">⚠️ Найгірший вихід</div>
      <div className="font-bold text-lg text-red-500">{stats.worstYield.pct.toFixed(1)}%</div>
      <div className="text-[10px] text-gray-400 mt-0.5 truncate">{stats.worstYield.name}</div>
    </div>

    {/* Без націнки */}
    <div className={`bg-white shadow-sm rounded-2xl px-4 py-3 border ${
      stats.withoutMarkup > 0 ? 'border-orange-100' : 'border-gray-100'
    }`}>
      <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Без ціни продажу</div>
      {stats.withoutMarkup > 0 ? (
        <>
          <div className="font-bold text-lg text-orange-500">{stats.withoutMarkup} партій</div>
          <div className="text-[10px] text-orange-400 mt-0.5">потребують націнки</div>
        </>
      ) : (
        <>
          <div className="font-bold text-lg text-emerald-600">✓ Всі</div>
          <div className="text-[10px] text-gray-400 mt-0.5">ціни встановлено</div>
        </>
      )}
    </div>
  </div>
)}

      {/* Список партій — тільки вкладка Розрахунки */}
      {activeTab === 'calcs' && isLoading ? (
        <div className="text-center text-gray-400 py-12">Завантаження...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-16 border-2 border-dashed border-gray-200 rounded-2xl">
          <div className="text-5xl mb-4">⚙️</div>
          {hasFilters ? (
            <>
              <div className="font-semibold text-gray-500">Нічого не знайдено</div>
              <button onClick={resetFilters} className="mt-2 text-xs text-purple-500 hover:text-purple-700">
                Скинути фільтри
              </button>
            </>
          ) : (
            <>
              <div className="font-semibold text-gray-500 text-lg">Немає розрахунків</div>
              <div className="text-sm mt-2 text-gray-400">
                Проведіть виробництво і поставте галочку<br />
                <span className="font-medium text-purple-600">«Записати в калькулятор»</span>
              </div>
            </>
          )}
        </div>
      ) : (
        activeTab === 'calcs' ? (
          <div className="space-y-3">
            {filtered.map((calc: ProductionCalc) => (
              <CalcCard key={calc.id} calc={calc} onDelete={handleDelete} />
            ))}
          </div>
        ) : null
      )}
    </div>
  );
}

// ─── AI Ціноутворення ────────────────────────────────────────────────────────
type AiPrice = { price: number; markup: number; margin: number };

function AiPricingTab({ calcs }: { calcs: ProductionCalc[] }) {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'halfyear'>('month');
  const [vatIncluded, setVatIncluded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [aiPrices, setAiPrices] = useState<Record<string, AiPrice>>({});
  const [lastUpdated, setLastUpdated] = useState('');

  const periodLabels = { month: '1 місяць', quarter: '3 місяці', halfyear: '6 місяців' };

  const { data: productStats = [] } = useQuery({
    queryKey: ['stat-products-ai', period],
    queryFn: () => {
      const to = new Date().toISOString();
      const from = new Date();
      if (period === 'month') from.setMonth(from.getMonth() - 1);
      else if (period === 'quarter') from.setMonth(from.getMonth() - 3);
      else from.setMonth(from.getMonth() - 6);
      return api.get('/statistics/products', { params: { from: from.toISOString(), to } }).then(r => r.data);
    },
  });

  const productMap = useMemo(() => {
    const map = new Map<string, { name: string; costs: number[]; markups: number[]; salePrices: number[]; totalQty: number }>();
    calcs.forEach(calc => {
      // Собівартість береться з батьківського calc (точніша), або з output
      const batchCost = Number(calc.costPerKg) || 0;
      calc.outputs.forEach(o => {
        const name = o.productName?.trim();
        if (!name) return;
        if (!map.has(name)) map.set(name, { name, costs: [], markups: [], salePrices: [], totalQty: 0 });
        const e = map.get(name)!;
        const cost = batchCost > 0 ? batchCost : Number(o.costPerKg) || 0;
        if (cost > 0) e.costs.push(cost);
        const markup = o.markupPct != null ? Number(o.markupPct) : null;
        if (markup != null && !isNaN(markup)) e.markups.push(markup);
        // salePricePerKg: берем збережене або рахуємо з markup
        let salePrice = o.salePricePerKg != null ? Number(o.salePricePerKg) : null;
        if ((salePrice == null || salePrice === 0) && cost > 0 && markup != null) {
          salePrice = cost * (1 + markup / 100);
        }
        if (salePrice != null && salePrice > 0 && !isNaN(salePrice)) e.salePrices.push(salePrice);
        e.totalQty += Number(o.quantity) || 0;
      });
    });
    return map;
  }, [calcs]);

  const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + Number(v), 0) / arr.length : 0;

  // Поєднуємо дані калькулятора зі статистикою продажів
  const enriched = useMemo(() => {
    return Array.from(productMap.values()).map(p => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stat = (productStats as any[]).find((s: any) =>
        s.productName?.toLowerCase().trim() === p.name.toLowerCase().trim()
      );
      return {
        name: p.name,
        avgCost: avg(p.costs),
        avgSalePrice: avg(p.salePrices),
        avgMarkup: avg(p.markups),
        monthlyKg: stat ? Number(stat.totalActualWeight) : 0,
        monthlyRevenue: stat ? Number(stat.revenue || 0) * 1.2 : 0,
      };
    });
  }, [productMap, productStats]);

  const totalMonthlyKg = enriched.reduce((s, p) => s + p.monthlyKg, 0);

  const handleAnalyze = async () => {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) return;
    setLoading(true); setResult(''); setAiPrices({});

    const rows = enriched.map(p => {
      const share = totalMonthlyKg > 0 ? (p.monthlyKg / totalMonthlyKg * 100).toFixed(0) : '0';
      const currentMargin = p.avgSalePrice > 0 ? ((p.avgSalePrice - p.avgCost) / p.avgCost * 100).toFixed(0) : '?';
      return `- ${p.name}: собів ${p.avgCost.toFixed(2)} ₴/кг | місячний обсяг ${p.monthlyKg.toFixed(0)} кг (${share}% від загального) | поточна ціна ${p.avgSalePrice > 0 ? p.avgSalePrice.toFixed(2) + ' ₴/кг' : 'не вст.'} | поточна маржа ${currentMargin}% | виручка за період ${p.monthlyRevenue.toFixed(0)} ₴`;
    }).join('\n');

    const prompt = `Ти — фінансовий консультант рибного виробництва. Проаналізуй реальні дані і дай КОНКРЕТНІ рекомендації по ціні для кожного продукту.

ВАЖЛИВО: У кожного продукту різний місячний обсяг — ціна має відповідати реальному попиту і собівартості. НЕ використовуй однаковий відсоток для всіх.

**Продукція за останні ${periodLabels[period]}:**
${rows || '— немає даних'}

**Загальний місячний обсяг:** ${totalMonthlyKg.toFixed(0)} кг
**ПДВ:** ${vatIncluded ? '20% (всі ціни з ПДВ)' : 'не включений'}
**Ринок:** продуктові магазини Вінницька + Хмельницька обл.

**Завдання:** для кожного продукту рекомендуй конкретну ціну і поясни логіку виходячи з:
1. Собівартості (мінімальна маржа щоб не працювати в мінус)
2. Місячного обсягу (великий обсяг = можна менша маржа, малий = потрібна більша)
3. Поточного рівня цін (чи є куди підняти без втрати ринку)

**Формат відповіді:**
Спочатку короткий аналіз (3-5 речень), потім таблиця:
| Продукт | Собів. | Рек. ціна б/ПДВ | Рек. ціна з ПДВ | Маржа % | Логіка |

В кінці обов'язково додай JSON-блок (для автозаповнення таблиці):
\`\`\`json
{"prices":{"НАЗВА_ПРОДУКТУ":{"price":X.XX,"markup":X,"margin":X}}}
\`\`\`
де НАЗВА_ПРОДУКТУ — точна назва як у таблиці, price — рекомендована ціна ${vatIncluded ? 'з ПДВ' : 'без ПДВ'}.`;

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await resp.json();
      const text: string = data.content?.[0]?.text || '';
      setResult(text);
      setLastUpdated(new Date().toLocaleTimeString('uk-UA'));

      // Парсимо JSON з відповіді для автозаповнення таблиці
      const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.prices) setAiPrices(parsed.prices);
        } catch { /* ignore parse error */ }
      }
    } catch {
      setResult('Помилка підключення до AI');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Параметри */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h2 className="font-bold text-gray-800 text-base mb-4">⚙️ Параметри аналізу</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Період статистики</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              {(['month','quarter','halfyear'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-3 py-2 font-medium ${period === p ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                  {periodLabels[p]}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer pb-0.5">
            <input type="checkbox" checked={vatIncluded} onChange={e => setVatIncluded(e.target.checked)}
              className="w-4 h-4 accent-purple-600 rounded" />
            <span className="text-sm text-gray-600 font-medium">Ціни з ПДВ 20%</span>
          </label>
          <button onClick={handleAnalyze} disabled={loading || enriched.length === 0}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-40 shadow-sm ml-auto">
            {loading ? <><span className="animate-spin">⏳</span> Аналізую...</> : '🤖 Розрахувати ціни'}
          </button>
        </div>
      </div>

      {/* Таблиця з даними */}
      {enriched.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-800 text-sm">
              📊 Зведена таблиця — {enriched.length} продуктів
              <span className="ml-2 text-xs font-normal text-gray-400">· обсяги за {periodLabels[period]}</span>
            </h2>
            {totalMonthlyKg > 0 && (
              <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">
                Загалом: {totalMonthlyKg.toFixed(0)} кг
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500 font-semibold uppercase tracking-wide text-[10px]">
                  <th className="px-4 py-3">Продукт</th>
                  <th className="px-4 py-3 text-right">Собів. ₴/кг</th>
                  <th className="px-4 py-3 text-right">Обсяг кг</th>
                  <th className="px-4 py-3 text-right">Частка %</th>
                  <th className="px-4 py-3 text-right">Поточна ціна</th>
                  <th className="px-4 py-3 text-right">Маржа %</th>
                  <th className="px-4 py-3 text-right bg-purple-50 text-purple-600">AI ціна {vatIncluded ? 'з ПДВ' : 'б/ПДВ'}</th>
                  <th className="px-4 py-3 text-right bg-purple-50 text-purple-600">AI маржа</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {enriched.map(p => {
                  const marginPct = p.avgSalePrice > 0 ? ((p.avgSalePrice - p.avgCost) / p.avgCost * 100) : null;
                  const marginColor = marginPct == null ? 'text-gray-400' : marginPct >= 20 ? 'text-green-600' : marginPct >= 10 ? 'text-yellow-600' : 'text-red-500';
                  const share = totalMonthlyKg > 0 ? (p.monthlyKg / totalMonthlyKg * 100) : 0;
                  const ai = aiPrices[p.name];
                  const barW = Math.min(100, share);
                  return (
                    <tr key={p.name} className="hover:bg-purple-50/30">
                      <td className="px-4 py-3 font-semibold text-gray-800">{p.name}</td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {p.avgCost > 0 && !isNaN(p.avgCost) ? `${p.avgCost.toFixed(2)} ₴` : <span className="text-orange-400 text-[10px]">не вист.</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${barW}%` }} />
                          </div>
                          <span className="text-gray-700 font-medium">{p.monthlyKg > 0 ? p.monthlyKg.toFixed(0) : <span className="text-gray-300">—</span>}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-blue-600 font-semibold">{share > 0 ? `${share.toFixed(0)}%` : '—'}</td>
                      <td className="px-4 py-3 text-right">{p.avgSalePrice > 0 ? `${p.avgSalePrice.toFixed(2)} ₴` : <span className="text-orange-400">—</span>}</td>
                      <td className={`px-4 py-3 text-right font-bold ${marginColor}`}>
                        {marginPct != null ? `${marginPct.toFixed(0)}%` : p.avgMarkup > 0 ? `${p.avgMarkup.toFixed(0)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right bg-purple-50/50 font-bold text-purple-700">
                        {ai ? `${ai.price.toFixed(2)} ₴` : <span className="text-purple-200">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right bg-purple-50/50 font-bold text-purple-600">
                        {ai ? `${ai.margin.toFixed(0)}%` : <span className="text-purple-200">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!Object.keys(aiPrices).length && (
            <div className="px-4 py-2.5 bg-purple-50/50 border-t border-purple-100 text-[10px] text-purple-400 flex items-center gap-1.5">
              🤖 Натисни «Розрахувати ціни» щоб AI заповнив колонки рекомендованих цін
            </div>
          )}
        </div>
      )}

      {enriched.length === 0 && !loading && !result && (
        <div className="text-center py-16 border-2 border-dashed border-purple-200 rounded-2xl">
          <div className="text-5xl mb-3">🤖</div>
          <p className="font-semibold text-gray-500">Немає даних для аналізу</p>
          <p className="text-sm text-gray-400 mt-1">Спочатку проведіть розрахунки у вкладці «Розрахунки»</p>
        </div>
      )}

      {/* AI результат */}
      {(loading || result) && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-purple-200 flex items-center justify-between bg-white/60">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <div>
                <div className="font-bold text-purple-800 text-sm">Аналіз і рекомендації AI (Claude Sonnet)</div>
                {lastUpdated && <div className="text-xs text-purple-400">Оновлено: {lastUpdated} · {periodLabels[period]} статистики</div>}
              </div>
            </div>
            {!loading && result && (
              <button onClick={handleAnalyze} className="text-xs text-purple-600 hover:text-purple-800 border border-purple-300 px-2.5 py-1 rounded-lg hover:bg-purple-50">
                🔄 Переаналізувати
              </button>
            )}
          </div>
          <div className="p-5">
            {loading ? (
              <div className="flex flex-col items-center py-8 gap-3">
                <div className="flex gap-1.5">
                  {[0,1,2].map(i => <div key={i} className="w-3 h-3 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                </div>
                <p className="text-sm text-purple-600">AI аналізує обсяги та собівартість...</p>
              </div>
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
                {result.replace(/```json[\s\S]*?```/g, '').trim()}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}