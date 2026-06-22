import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';

type Product = { id: string; name: string; unit: string; category: string; isActive: boolean; groupId?: string | null; group?: { id: string; name: string } | null };

type Contributor = { productId: string; productName: string; qty: number };

type ForecastItem = {
  productId: string;
  productName: string;
  unit: string;
  weeklyDemand: number;
  currentStock: number;
  totalNeeded: number;
  toOrder: number;
  leadDays: number;
  orderByDate: string;
  contributors: Contributor[];
};

type ForecastResponse = { weeks: number; nextWeekStart: string; items: ForecastItem[] };

type BomRow = {
  id: string;
  outputProductId: string;
  inputProductId: string;
  yieldPct: string;
  leadDays: number;
  note: string | null;
  outputProduct: { id: string; name: string; unit: string };
  inputProduct: { id: string; name: string; unit: string };
};

function fmt(n: number) {
  return n.toLocaleString('uk-UA', { minimumFractionDigits: n % 1 === 0 ? 0 : 1, maximumFractionDigits: 2 });
}

function urgency(days: number) {
  if (days <= 1) return { label: 'сьогодні/завтра', cls: 'bg-red-100 text-red-700 border-red-200' };
  if (days <= 3) return { label: `за ${days} дн.`, cls: 'bg-amber-100 text-amber-700 border-amber-200' };
  return { label: `за ${days} дн.`, cls: 'bg-gray-100 text-gray-600 border-gray-200' };
}

// ─── Картка одного товару прогнозу ────────────────────────────────────────────
function ForecastCard({ item, weeks }: { item: ForecastItem; weeks: number }) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const orderBy = new Date(item.orderByDate);
  const daysLeft = Math.ceil((orderBy.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const u = urgency(Math.max(daysLeft, 0));
  const coverage = item.weeklyDemand > 0 ? Math.min(100, Math.round((item.currentStock / item.weeklyDemand) * 100)) : 100;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full text-left p-4 hover:bg-gray-50/60 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 border border-orange-200 flex items-center justify-center text-lg shrink-0">🐟</div>
            <div className="min-w-0">
              <div className="font-bold text-gray-800 text-sm truncate">{item.productName}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                попит ∅ {fmt(item.weeklyDemand)} {item.unit}/тиж · запас {fmt(item.currentStock)} {item.unit}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            {item.toOrder > 0 ? (
              <>
                <div className="text-lg font-bold text-orange-600">{fmt(item.toOrder)} {item.unit}</div>
                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mt-0.5 ${u.cls}`}>
                  замовити {u.label}
                </span>
              </>
            ) : (
              <span className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                ✓ запасу достатньо
              </span>
            )}
          </div>
        </div>
        {item.weeklyDemand > 0 && (
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-3">
            <div
              className={`h-full rounded-full transition-all ${coverage >= 100 ? 'bg-emerald-400' : coverage >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
              style={{ width: `${coverage}%` }}
            />
          </div>
        )}
      </button>
      {open && item.contributors.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-3">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Чому саме стільки</div>
          <div className="space-y-1.5">
            {item.contributors.map((c) => (
              <div key={c.productId} className="flex items-center justify-between text-xs">
                <span className="text-gray-600">📦 {c.productName}</span>
                <span className="font-semibold text-gray-700">{fmt(c.qty)} {item.unit}</span>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-gray-400 mt-2">
            на основі середнього попиту за останні {weeks} тиж. та лід-тайму виробництва {item.leadDays} дн.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Модалка додавання BOM-рядка ──────────────────────────────────────────────
function BomModal({ products, onClose }: { products: Product[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [outputProductId, setOutputProductId] = useState('');
  const [inputProductId, setInputProductId] = useState('');
  const [yieldPct, setYieldPct] = useState('100');
  const [leadDays, setLeadDays] = useState('0');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!outputProductId || !inputProductId || !yieldPct) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/bom', {
        outputProductId,
        inputProductId,
        yieldPct: Number(yieldPct),
        leadDays: Number(leadDays) || 0,
        note: note || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['bom'] });
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Помилка збереження');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md">
        <div className="px-5 pt-5 pb-4 border-b flex items-center justify-between">
          <h2 className="font-bold text-gray-800 text-lg">🧪 Новий технологічний зв'язок</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Готовий товар (виробляємо)</label>
            <select value={outputProductId} onChange={(e) => setOutputProductId(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">— Обрати —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.group ? ` (група: ${p.group.name})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">З чого зроблений (сировина / попередній крок)</label>
            <select value={inputProductId} onChange={(e) => setInputProductId(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">— Обрати —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.group ? ` (група: ${p.group.name})` : ''}</option>)}
            </select>
          </div>
          {(() => {
            const outProduct = products.find((p) => p.id === outputProductId);
            return outProduct?.group ? (
              <div className="text-[11px] text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                ℹ️ "{outProduct.name}" входить у групу взаємозаміни "{outProduct.group.name}" — достатньо одного зв'язку на всю групу, інші товари групи (вагова/в-у тощо) рахуватимуться разом автоматично.
              </div>
            ) : null;
          })()}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">% виходу</label>
              <input type="number" min="1" max="100" step="0.1" value={yieldPct} onChange={(e) => setYieldPct(e.target.value)}
                placeholder="70"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-500" />
              <p className="text-[10px] text-gray-400 mt-1">скільки кг готового з 1 кг сировини</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Днів виробництва</label>
              <input type="number" min="0" step="1" value={leadDays} onChange={(e) => setLeadDays(e.target.value)}
                placeholder="4"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Примітка</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Необов'язково..."
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
        </div>
        <div className="px-5 pb-6 flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm py-3 rounded-xl hover:bg-gray-50 font-medium">Скасувати</button>
          <button onClick={handleSave} disabled={loading || !outputProductId || !inputProductId}
            className="flex-1 bg-orange-600 text-white text-sm py-3 rounded-xl hover:bg-orange-700 disabled:opacity-50 font-bold">
            {loading ? '...' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Головна сторінка ─────────────────────────────────────────────────────────
type Tab = 'forecast' | 'bom';

export default function ForecastPage() {
  const [tab, setTab] = useState<Tab>('forecast');
  const [weeks, setWeeks] = useState(8);
  const [showBomModal, setShowBomModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: forecast, isLoading } = useQuery<ForecastResponse>({
    queryKey: ['forecast', weeks],
    queryFn: () => api.get('/forecast', { params: { weeks } }).then((r) => r.data),
  });

  const { data: bomRows = [] } = useQuery<BomRow[]>({
    queryKey: ['bom'],
    queryFn: () => api.get('/bom').then((r) => r.data),
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => api.get('/products').then((r) => r.data),
  });

  const deleteBomMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bom/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bom'] }),
  });

  const items = forecast?.items ?? [];
  const toOrderItems = items.filter((i) => i.toOrder > 0);
  const okItems = items.filter((i) => i.toOrder <= 0);
  const urgentCount = toOrderItems.filter((i) => {
    const days = Math.ceil((new Date(i.orderByDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days <= 1;
  }).length;

  // групуємо BOM по готовому товару для зручного відображення
  const bomByOutput = new Map<string, BomRow[]>();
  for (const row of bomRows) {
    const list = bomByOutput.get(row.outputProductId) ?? [];
    list.push(row);
    bomByOutput.set(row.outputProductId, list);
  }

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="bg-gradient-to-br from-slate-50 via-white to-orange-50/40 rounded-2xl sm:rounded-3xl border border-gray-100 p-3.5 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-lg sm:text-xl shadow-md shadow-orange-200 shrink-0">📦</div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-800">Прогноз закупівлі</h1>
              <p className="text-xs text-gray-400 mt-0.5">Скільки сировини замовити на наступний тиждень</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-gray-100 px-2.5 sm:px-4 py-2.5 sm:py-3 text-right">
              <div className="text-[10px] font-bold uppercase tracking-wide text-orange-600">🛒 До замовлення</div>
              <div className="text-base sm:text-lg font-bold leading-tight text-orange-700">{toOrderItems.length}</div>
            </div>
            {urgentCount > 0 && (
              <div className="bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-gray-100 px-2.5 sm:px-4 py-2.5 sm:py-3 text-right">
                <div className="text-[10px] font-bold uppercase tracking-wide text-red-500">🔥 Термінові</div>
                <div className="text-base sm:text-lg font-bold leading-tight text-red-600">{urgentCount}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm w-full sm:w-fit bg-white p-1 gap-1">
          <button onClick={() => setTab('forecast')}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap text-xs sm:text-sm ${tab === 'forecast' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>
            📋 Прогноз
          </button>
          <button onClick={() => setTab('bom')}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap text-xs sm:text-sm ${tab === 'bom' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>
            🧪 Технологічні карти
          </button>
        </div>
        {tab === 'forecast' && (
          <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500">
            <option value={4}>середнє за 4 тижні</option>
            <option value={8}>середнє за 8 тижнів</option>
            <option value={12}>середнє за 12 тижнів</option>
          </select>
        )}
      </div>

      {/* ── Вкладка: Прогноз ───────────────────────────────────────────────── */}
      {tab === 'forecast' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="bg-white border border-gray-100 rounded-2xl px-5 py-12 text-center text-gray-400 text-sm shadow-sm">Рахуємо...</div>
          ) : items.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl px-5 py-12 text-center shadow-sm">
              <div className="text-3xl mb-2">🧮</div>
              <div className="text-gray-400 text-sm">Недостатньо даних. Додай технологічні карти та історію заявок.</div>
            </div>
          ) : (
            <>
              {toOrderItems.length > 0 && (
                <div className="space-y-2.5">
                  {toOrderItems.map((item) => <ForecastCard key={item.productId} item={item} weeks={forecast!.weeks} />)}
                </div>
              )}
              {okItems.length > 0 && (
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-4">
                  <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2">✓ Запасу достатньо ({okItems.length})</div>
                  <div className="flex flex-wrap gap-1.5">
                    {okItems.map((i) => (
                      <span key={i.productId} className="text-[11px] bg-white/70 text-emerald-700 px-2.5 py-1 rounded-full font-medium border border-emerald-100">
                        {i.productName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Вкладка: Технологічні карти ────────────────────────────────────── */}
      {tab === 'bom' && (
        <div className="space-y-4">
          <button onClick={() => setShowBomModal(true)}
            className="w-full bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 text-orange-700 text-sm font-bold py-3 rounded-2xl hover:shadow-md transition-all flex items-center justify-center gap-2">
            <span>➕</span> Додати технологічний зв'язок
          </button>

          {bomByOutput.size === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl px-5 py-12 text-center shadow-sm">
              <div className="text-3xl mb-2">🧪</div>
              <div className="text-gray-400 text-sm">Технологічних карт ще немає. Додай, з чого і як виробляється кожен готовий товар.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {Array.from(bomByOutput.entries()).map(([outputId, rows]) => (
                <div key={outputId} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
                    <span className="text-base">🐟</span>
                    <span className="text-sm font-bold text-gray-800">{rows[0].outputProduct.name}</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {rows.map((row) => (
                      <div key={row.id} className="px-4 py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-700">
                            <span className="text-gray-400">з</span> <span className="font-semibold">{row.inputProduct.name}</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            вихід {Number(row.yieldPct)}% · {row.leadDays} дн. виробництва
                            {row.note && <> · {row.note}</>}
                          </div>
                        </div>
                        <button onClick={() => { if (confirm('Видалити зв\'язок?')) deleteBomMutation.mutate(row.id); }}
                          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 text-xs shrink-0">🗑</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showBomModal && <BomModal products={products} onClose={() => setShowBomModal(false)} />}
    </div>
  );
}
