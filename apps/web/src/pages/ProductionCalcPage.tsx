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
    <div className="grid grid-cols-12 gap-3 items-center py-3 border-b border-gray-100 last:border-0">
      {/* Назва продукту */}
      <div className="col-span-4 flex items-center gap-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
          output.form === 'FORM_1' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
        }`}>
          {output.form === 'FORM_1' ? 'Ф1' : 'Ф2'}
        </span>
        <div className="min-w-0">
          <div className="font-semibold text-gray-800 text-sm truncate">{output.productName}</div>
          <div className="text-[10px] text-gray-400">
            {Number(output.quantity).toFixed(3)} кг · собів. {costPerKg.toFixed(2)} ₴/кг
          </div>
        </div>
      </div>

      {/* Націнка % */}
      <div className="col-span-2">
        <div className="flex items-center gap-1">
          <input
            type="number" step="0.1" min="0"
            value={markup}
            onChange={(e) => setMarkup(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && isDirty && handleSave()}
            placeholder="0"
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white font-semibold"
          />
          <span className="text-xs text-gray-400 shrink-0">%</span>
        </div>
      </div>

      {/* Ціна продажу */}
      <div className="col-span-2 text-right">
        <div className="font-bold text-purple-700 text-sm">{salePrice.toFixed(2)} ₴/кг</div>
        <div className="text-[10px] text-gray-400">ціна продажу</div>
      </div>

      {/* Маржа */}
      <div className="col-span-2">
        <div className={`rounded-lg border px-2.5 py-1.5 text-center ${marginBg}`}>
          <div className={`font-bold text-sm ${marginColor}`}>{marginPct.toFixed(1)}%</div>
          <div className="text-[10px] text-gray-500">{marginPerKg.toFixed(2)} ₴/кг</div>
        </div>
      </div>

      {/* Загальна маржа або кнопка зберегти */}
      <div className="col-span-2">
        {isDirty ? (
          <button onClick={handleSave} disabled={saving}
            className="w-full bg-purple-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors font-bold">
            {saving ? '...' : 'Зберегти'}
          </button>
        ) : (
          <div className="text-right">
            <div className={`font-bold text-sm ${marginColor}`}>{marginTotal.toFixed(2)} ₴</div>
            <div className="text-[10px] text-gray-400">маржа всього</div>
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
      expanded ? 'border-purple-200' : 'border-gray-200'
    }`}>
      {/* Шапка */}
      <div
        onClick={() => setExpanded(!expanded)}
        className={`px-5 py-4 cursor-pointer transition-colors flex items-center justify-between gap-4 ${
          expanded ? 'bg-purple-600' : 'bg-gray-50 hover:bg-gray-100'
        }`}
      >
        {/* Ліва частина: дата + теги */}
        <div className="flex items-center gap-4 flex-wrap min-w-0">
          <div className="shrink-0">
            <div className={`font-bold text-sm ${expanded ? 'text-white' : 'text-gray-800'}`}>{date}</div>
            {calc.note && (
              <div className={`text-xs mt-0.5 ${expanded ? 'text-purple-200' : 'text-gray-400'}`}>{calc.note}</div>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {calc.inputs.map((inp) => (
              <span key={inp.id} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                expanded ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {inp.productName} {Number(inp.quantity).toFixed(1)} кг
              </span>
            ))}
            <span className={`text-xs ${expanded ? 'text-purple-300' : 'text-gray-300'}`}>→</span>
            {calc.outputs.map((out) => (
              <span key={out.id} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                expanded ? 'bg-purple-500 text-white' : 'bg-purple-100 text-purple-700'
              }`}>
                {out.productName} {Number(out.quantity).toFixed(1)} кг
              </span>
            ))}
          </div>
        </div>

        {/* Права частина: статистика */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-center">
              <div className={`text-[10px] font-semibold uppercase tracking-wide ${expanded ? 'text-purple-200' : 'text-gray-400'}`}>Собівартість</div>
              <div className={`font-bold text-sm ${expanded ? 'text-white' : 'text-purple-700'}`}>{costPerKg.toFixed(2)} ₴/кг</div>
            </div>
            <div className={`w-px h-7 ${expanded ? 'bg-purple-400' : 'bg-gray-200'}`} />
            <div className="text-center">
              <div className={`text-[10px] font-semibold uppercase tracking-wide ${expanded ? 'text-purple-200' : 'text-gray-400'}`}>Вихід</div>
              <div className={`font-bold text-sm ${expanded ? yieldColorExpanded : yieldColorCollapsed}`}>
                {yieldPct.toFixed(1)}%
              </div>
            </div>
            {hasMarkups && (
              <>
                <div className={`w-px h-7 ${expanded ? 'bg-purple-400' : 'bg-gray-200'}`} />
                <div className="text-center">
                  <div className={`text-[10px] font-semibold uppercase tracking-wide ${expanded ? 'text-purple-200' : 'text-gray-400'}`}>Маржа</div>
                  <div className={`font-bold text-sm ${expanded ? 'text-green-300' : 'text-green-600'}`}>
                    {totalMargin.toFixed(2)} ₴
                  </div>
                </div>
              </>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(calc.id); }}
            className={`text-sm px-1 transition-colors ${expanded ? 'text-purple-300 hover:text-white' : 'text-gray-400 hover:text-red-500'}`}>
            🗑
          </button>
          <span className={`text-base transition-transform duration-200 inline-block ${expanded ? 'rotate-180' : ''} ${expanded ? 'text-white' : 'text-gray-400'}`}>
            ↓
          </span>
        </div>
      </div>

      {/* Розгорнутий вміст */}
      {expanded && (
        <div className="p-5 space-y-5">

          {/* Таблиця сировини */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-bold shrink-0">↑</span>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Сировина</span>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] text-gray-400 uppercase tracking-wide border-b border-red-100">
                    <th className="px-3 py-2.5 text-left font-semibold">Продукт</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Постачальник</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Кількість</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Ціна/кг</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Вартість</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.inputs.map((inp) => (
                    <tr key={inp.id} className="border-t border-red-100 hover:bg-red-100/30">
                      {/* Продукт */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                            inp.form === 'FORM_1' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                          }`}>
                            {inp.form === 'FORM_1' ? 'Ф1' : 'Ф2'}
                          </span>
                          <span className="font-semibold text-gray-700">{inp.productName}</span>
                        </div>
                      </td>
                      {/* Постачальник */}
                      <td className="px-3 py-2.5">
                        {inp.supplierName
                          ? <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-lg text-xs font-medium">{inp.supplierName}</span>
                          : <span className="text-gray-300 text-xs">—</span>
                        }
                      </td>
                      {/* Кількість */}
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-700">
                        {Number(inp.quantity).toFixed(3)} кг
                      </td>
                      {/* Ціна/кг */}
                      <td className="px-3 py-2.5 text-right text-gray-500">
                        {Number(inp.pricePerKg).toFixed(2)} ₴
                      </td>
                      {/* Вартість */}
                      <td className="px-3 py-2.5 text-right font-bold text-red-600">
                        {Number(inp.totalCost).toFixed(2)} ₴
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-red-200 bg-red-100/60">
                    <td className="px-3 py-2 font-bold text-gray-700" colSpan={4}>Всього витрат</td>
                    <td className="px-3 py-2 text-right font-bold text-red-700">{totalInputCost.toFixed(2)} ₴</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Рядок з інфо про вихід */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-dashed border-gray-200" />
            <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-xl px-4 py-2 text-xs flex-wrap justify-center">
              <span className="text-gray-500">
                Сировина: <b className="text-gray-700">{totalInputQty.toFixed(2)} кг</b>
              </span>
              <span className="text-gray-300">·</span>
              <span className="text-gray-500">
                Вихід: <b className={yieldPct >= 80 ? 'text-green-600' : 'text-orange-500'}>{yieldPct.toFixed(1)}%</b>
              </span>
              <span className="text-gray-300">·</span>
              <span className="text-gray-500">
                Готової: <b className="text-gray-700">{totalOutputQty.toFixed(2)} кг</b>
              </span>
              <span className="text-gray-300">·</span>
              <span className="text-gray-500">
                Собівартість: <b className="text-purple-700">{costPerKg.toFixed(2)} ₴/кг</b>
              </span>
            </div>
            <div className="flex-1 border-t border-dashed border-gray-200" />
          </div>

          {/* Таблиця готової продукції */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-[10px] font-bold shrink-0">↓</span>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Готова продукція · Ціноутворення</span>
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200 text-[10px] text-gray-400 font-bold uppercase tracking-wide">
                <div className="col-span-4">Продукт</div>
                <div className="col-span-2 text-right">Націнка %</div>
                <div className="col-span-2 text-right">Ціна продажу</div>
                <div className="col-span-2 text-center">Маржа</div>
                <div className="col-span-2 text-right">Загалом</div>
              </div>
              <div className="px-4">
                {calc.outputs.map((output) => (
                  <OutputRow key={output.id} output={output} costPerKg={costPerKg} />
                ))}
              </div>
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
      {/* Заголовок */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Калькулятор виробництва</h1>
          <p className="text-xs text-gray-400 mt-0.5">Собівартість · Ціноутворення · Маржа</p>
        </div>
        <button onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
            showFilters || hasFilters
              ? 'bg-purple-600 text-white border-purple-600'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}>
          🔍 Фільтри
          {hasFilters && (
            <span className="bg-white text-purple-600 text-xs px-1.5 py-0.5 rounded-full font-bold">
              {[search, dateFrom, dateTo].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {/* Фільтри */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">
                Пошук по продукту або постачальнику
              </label>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Назва..."
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">Від</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">До</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
          </div>
          {hasFilters && (
            <button onClick={resetFilters} className="text-xs text-red-500 hover:text-red-700 transition-colors">
              × Скинути фільтри
            </button>
          )}
        </div>
      )}

{/* Статистика */}
{stats && (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {/* Партій */}
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
      <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Партій</div>
      <div className="font-bold text-xl text-gray-800">{stats.count}</div>
    </div>

    {/* Найкращий вихід */}
    <div className="bg-white border border-green-200 rounded-xl px-4 py-3">
      <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Найкращий вихід</div>
      <div className="font-bold text-lg text-green-600">{stats.bestYield.pct.toFixed(1)}%</div>
      <div className="text-[10px] text-gray-500 mt-0.5 truncate">{stats.bestYield.name}</div>
    </div>

    {/* Найгірший вихід */}
    <div className="bg-white border border-red-200 rounded-xl px-4 py-3">
      <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Найгірший вихід</div>
      <div className="font-bold text-lg text-red-500">{stats.worstYield.pct.toFixed(1)}%</div>
      <div className="text-[10px] text-gray-500 mt-0.5 truncate">{stats.worstYield.name}</div>
    </div>

    {/* Без націнки */}
    <div className={`bg-white rounded-xl px-4 py-3 border ${
      stats.withoutMarkup > 0 ? 'border-orange-200' : 'border-gray-200'
    }`}>
      <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Без ціни продажу</div>
      {stats.withoutMarkup > 0 ? (
        <>
          <div className="font-bold text-lg text-orange-500">{stats.withoutMarkup} партій</div>
          <div className="text-[10px] text-orange-400 mt-0.5">потребують націнки</div>
        </>
      ) : (
        <>
          <div className="font-bold text-lg text-green-600">✓ Всі</div>
          <div className="text-[10px] text-gray-400 mt-0.5">ціни встановлено</div>
        </>
      )}
    </div>
  </div>
)}

      {/* Список партій */}
      {isLoading ? (
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
        <div className="space-y-3">
          {filtered.map((calc: ProductionCalc) => (
            <CalcCard key={calc.id} calc={calc} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}