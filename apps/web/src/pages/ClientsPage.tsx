import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { useAuthStore } from '@/store/auth';
import { Client, Form } from '@/types';

const getAvatarColor = (name: string) => {
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-red-500', 'bg-cyan-500'];
  return colors[name.charCodeAt(0) % colors.length];
};

// ─── CopyPriceModal ───────────────────────────────────────────────────────────
function CopyPriceModal({ targetClient, form, allClients, onClose }: {
  targetClient: Client; form: Form; allClients: Client[]; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [sourceClientId, setSourceClientId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: sourcePrices = [] } = useQuery({
    queryKey: ['client-prices', sourceClientId, form],
    queryFn: () => api.get(`/clients/${sourceClientId}/prices`, { params: { form } }).then(r => r.data),
    enabled: !!sourceClientId,
  });

  const handleCopy = async () => {
    if (!sourceClientId) return setError('Оберіть клієнта');
    if (!sourcePrices.length) return setError('У обраного клієнта немає цін');
    setLoading(true);
    try {
      await api.patch(`/clients/${targetClient.id}/prices`, {
        prices: sourcePrices.map((p: any) => ({ productId: p.productId, price: Number(p.price), form })),
      });
      queryClient.invalidateQueries({ queryKey: ['client-prices', targetClient.id] });
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Помилка');
    } finally { setLoading(false); }
  };

  const otherClients = allClients.filter(c => c.id !== targetClient.id && c.isActive);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="font-bold text-gray-800">Скопіювати прайс</h3>
          <p className="text-xs text-gray-400 mt-0.5">Прайс буде скопійовано до <b>{targetClient.name}</b></p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Скопіювати від клієнта
            </label>
            <select value={sourceClientId} onChange={e => setSourceClientId(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Оберіть клієнта...</option>
              {otherClients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {sourceClientId && sourcePrices.length > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <div className="text-xs font-semibold text-blue-600 mb-2">Буде скопійовано ({sourcePrices.length} цін):</div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {sourcePrices.map((p: any) => (
                  <div key={p.productId} className="flex justify-between text-xs">
                    <span className="text-gray-600">{p.product?.name ?? p.productId}</span>
                    <span className="font-semibold text-gray-800">{Number(p.price).toFixed(2)} ₴</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {sourceClientId && sourcePrices.length === 0 && (
            <div className="text-xs text-orange-500 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2.5">
              ⚠️ У цього клієнта немає цін для форми {form === 'FORM_1' ? 'Ф1' : 'Ф2'}
            </div>
          )}

          {error && <div className="text-red-500 text-sm bg-red-50 px-3 py-2.5 rounded-xl">⚠️ {error}</div>}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50">Скасувати</button>
          <button onClick={handleCopy} disabled={loading || !sourceClientId || !sourcePrices.length}
            className="flex-1 bg-blue-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-bold">
            {loading ? 'Копіюю...' : '📋 Скопіювати'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── BulkPriceModal — масова зміна цін ───────────────────────────────────────
function BulkPriceModal({ allClients, onClose }: {
  allClients: Client[]; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>('FORM_1');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ['products-active'],
    queryFn: () => api.get('/products/active').then(r => r.data),
  });

  // Завантажуємо поточні ціни для вибраного продукту
  const { data: currentPrices = [] } = useQuery({
    queryKey: ['bulk-current-prices', selectedProductId, form],
    queryFn: () => api.get('/clients').then(async r => {
      const clients = r.data.filter((c: any) => c.isActive);
      const results = await Promise.all(
        clients.map((c: any) =>
          api.get(`/clients/${c.id}/prices`, { params: { form } })
            .then(pr => ({ clientId: c.id, price: pr.data.find((p: any) => p.productId === selectedProductId)?.price ?? null }))
        )
      );
      return results;
    }),
    enabled: !!selectedProductId,
  });

  const getCurrentPrice = (clientId: string) => {
    const found = currentPrices.find((p: any) => p.clientId === clientId);
    return found?.price ? Number(found.price).toFixed(2) : null;
  };

  const activeClients = allClients.filter(c => c.isActive);

  const toggleClient = (id: string) => {
    setSelectedClientIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedClientIds(prev =>
      prev.length === activeClients.length ? [] : activeClients.map(c => c.id)
    );
  };

  const handleApply = async () => {
    if (!selectedProductId) return setError('Оберіть продукт');
    if (!newPrice || Number(newPrice) <= 0) return setError('Вкажіть ціну');
    if (!selectedClientIds.length) return setError('Оберіть хоча б одного клієнта');
    setLoading(true); setError('');
    try {
      await api.patch('/clients/bulk-prices', {
        clientIds: selectedClientIds,
        prices: [{ productId: selectedProductId, price: Number(newPrice), form }],
      });
      queryClient.invalidateQueries({ queryKey: ['client-prices'] });
      setDone(true);
      setTimeout(() => onClose(), 1500);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Помилка');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b shrink-0">
          <h3 className="font-bold text-gray-800">Масова зміна ціни</h3>
          <p className="text-xs text-gray-400 mt-0.5">Встановити одну ціну одразу кільком клієнтам</p>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Форма */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
            {([['FORM_1', '🏦 Ф1'], ['FORM_2', '💵 Ф2']] as [Form, string][]).map(([f, label]) => (
              <button key={f} onClick={() => setForm(f)}
                className={`flex-1 py-2 font-semibold transition-colors ${form === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Продукт і ціна */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Продукт</label>
              <select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Оберіть...</option>
                {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Нова ціна ₴/кг</label>
              <input type="number" step="0.01" min="0" value={newPrice} onChange={e => setNewPrice(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Список клієнтів */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Клієнти ({selectedClientIds.length} з {activeClients.length})
              </label>
              <button onClick={toggleAll} className="text-xs text-blue-500 hover:text-blue-700 font-semibold">
                {selectedClientIds.length === activeClients.length ? 'Зняти всіх' : 'Вибрати всіх'}
              </button>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto border border-gray-200 rounded-xl p-2">
              {activeClients.map(client => {
                const currentPrice = getCurrentPrice(client.id);
                const isSelected = selectedClientIds.includes(client.id);
                return (
                  <div key={client.id}
                    onClick={() => toggleClient(client.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${
                      isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
                    }`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                      }`}>
                        {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                      </div>
                      <div className={`w-6 h-6 rounded ${getAvatarColor(client.name)} flex items-center justify-center text-white text-[10px] font-bold`}>
                        {client.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{client.name}</span>
                    </div>
                    <div className="text-xs text-right">
                      {selectedProductId ? (
                        currentPrice
                          ? <span className="text-gray-400">зараз: <b className="text-gray-600">{currentPrice} ₴</b></span>
                          : <span className="text-gray-300">немає ціни</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Прев'ю зміни */}
          {selectedProductId && newPrice && selectedClientIds.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <div className="text-xs font-semibold text-green-700 mb-1">Буде застосовано:</div>
              <div className="text-sm text-green-800">
                <b>{products.find((p: any) => p.id === selectedProductId)?.name}</b> → <b>{newPrice} ₴</b> для <b>{selectedClientIds.length}</b> клієнтів
              </div>
            </div>
          )}

          {error && <div className="text-red-500 text-sm bg-red-50 px-3 py-2.5 rounded-xl">⚠️ {error}</div>}
          {done && <div className="text-green-600 text-sm bg-green-50 px-3 py-2.5 rounded-xl font-semibold">✓ Ціни оновлено!</div>}
        </div>

        <div className="px-5 pb-5 pt-3 border-t flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50">Скасувати</button>
          <button onClick={handleApply} disabled={loading || done}
            className="flex-1 bg-green-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50 font-bold">
            {loading ? 'Застосовую...' : done ? '✓ Готово' : `Застосувати до ${selectedClientIds.length} клієнтів`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ClientModal ──────────────────────────────────────────────────────────────
function ClientModal({ client, onClose }: { client?: Client; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(client?.name || '');
  const [edrpou, setEdrpou] = useState(client?.edrpou || '');
  const [address, setAddress] = useState(client?.address || '');
  const [contact, setContact] = useState(client?.contact || '');
  const [contractNumber, setContractNumber] = useState((client as any)?.contractNumber || '');
  const [bankAccount, setBankAccount] = useState((client as { bankAccount?: string })?.bankAccount || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) return setError('Вкажіть назву клієнта');
    setLoading(true); setError('');
    try {
      if (client) {
        await api.patch(`/clients/${client.id}`, { name, edrpou, address, contact, contractNumber, bankAccount });
      } else {
        await api.post('/clients', { name, edrpou, address, contact, contractNumber, bankAccount });
      }
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Помилка збереження');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-800">{client ? 'Редагувати клієнта' : 'Новий клієнт'}</h2>
        </div>
        <div className="p-4 space-y-3">
          {[
            { label: 'Назва *', value: name, onChange: setName, placeholder: 'ТОВ Рога і копита' },
            { label: 'ЄДРПОУ', value: edrpou, onChange: setEdrpou, placeholder: '12345678' },
            { label: 'Адреса', value: address, onChange: setAddress, placeholder: 'м. Київ, вул. Хрещатик 1' },
            { label: 'Контакт', value: contact, onChange: setContact, placeholder: '+380 99 999 9999' },
            { label: 'Номер договору / замовлення', value: contractNumber, onChange: setContractNumber, placeholder: 'Без замовлення' },
            { label: 'Розрахунковий рахунок (р/р)', value: bankAccount, onChange: setBankAccount, placeholder: 'UA12 3456 7890 0000 0000 0000 0000' },
          ].map((f) => (
            <div key={f.label}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <input value={f.value} onChange={(e) => f.onChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={f.placeholder} />
            </div>
          ))}
          {error && <div className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
        </div>
        <div className="p-4 border-t flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg hover:bg-gray-50">Скасувати</button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Збереження...' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ClientDetailsModal ───────────────────────────────────────────────────────
function ClientDetailsModal({ client, onClose, onEdit, isAdmin, allClients }: {
  client: Client; onClose: () => void; onEdit: () => void;
  isAdmin: boolean; allClients: Client[];
}) {
  const { user: currentUser } = useAuthStore();
  const isInspector = currentUser?.role === 'INSPECTOR';
  const [form, setForm] = useState<Form>('FORM_1');
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showCopyModal, setShowCopyModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['products-active'],
    queryFn: () => api.get('/products/active').then((r) => r.data),
  });

  const { data: clientPricesData = [], isLoading: pricesLoading } = useQuery({
    queryKey: ['client-prices', client.id, form],
    queryFn: () => api.get(`/clients/${client.id}/prices`, { params: { form } }).then((r) => r.data),
    staleTime: 0,
  });

  const { data: clientStats } = useQuery({
    queryKey: ['client-stats', client.id],
    queryFn: async () => {
      const to = new Date().toISOString();
      const from = new Date();
      from.setFullYear(from.getFullYear() - 1);
      const res = await api.get('/statistics/clients', { params: { from: from.toISOString(), to } });
      return res.data?.find((c: any) => c.clientId === client.id) ?? null;
    },
  });

  useEffect(() => {
    const map: Record<string, string> = {};
    clientPricesData.forEach((p: any) => { map[p.productId] = String(p.price); });
    setPrices(map);
  }, [clientPricesData]);

  const handleSavePrices = async () => {
    setSaving(true); setSaved(false); setError('');
    try {
      const items = Object.entries(prices)
        .filter(([, price]) => price !== '' && Number(price) > 0)
        .map(([productId, price]) => ({ productId, price: Number(price), form }));
      if (items.length === 0) { setError('Вкажіть хоча б одну ціну'); setSaving(false); return; }
      await api.patch(`/clients/${client.id}/prices`, { prices: items });
      queryClient.invalidateQueries({ queryKey: ['client-prices', client.id] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Помилка збереження');
    } finally { setSaving(false); }
  };

  const avatarColor = getAvatarColor(client.name);
  const pricesCount = Object.values(prices).filter(p => p && Number(p) > 0).length;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
          {/* Заголовок */}
          <div className="p-4 border-b shrink-0">
            <div className="flex items-start gap-3">
              <div className={`w-12 h-12 rounded-xl ${avatarColor} flex items-center justify-center text-white font-bold text-lg shrink-0`}>
                {client.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-gray-800 text-base truncate">{client.name}</h2>
                  {!client.isActive && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">Неактивний</span>}
                </div>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                  {client.edrpou && <span>📋 {client.edrpou}</span>}
                  {client.contact && <span>📞 {client.contact}</span>}
                  {client.address && <span className="hidden sm:inline">📍 {client.address}</span>}
                </div>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none shrink-0">×</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Статистика */}
            {clientStats && (
              <div className="p-4 border-b">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Статистика за рік</div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Заявок', value: clientStats.ordersCount || 0, color: 'bg-blue-50 text-blue-500', val: 'text-blue-700' },
                    { label: 'Виручка', value: `${Number(clientStats.revenue || 0).toFixed(0)} ₴`, color: 'bg-green-50 text-green-500', val: 'text-green-700' },
                    { label: 'Вага (кг)', value: Number(clientStats.totalWeight || 0).toFixed(0), color: 'bg-orange-50 text-orange-500', val: 'text-orange-700' },
                  ].map(s => (
                    <div key={s.label} className={`${s.color.split(' ')[0]} rounded-lg p-3 text-center`}>
                      <div className={`text-xs ${s.color.split(' ')[1]} mb-1`}>{s.label}</div>
                      <div className={`text-lg font-bold ${s.val}`}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Прайс */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Прайс-лист
                  {pricesCount > 0 && <span className="ml-2 bg-green-100 text-green-600 px-1.5 py-0.5 rounded font-normal normal-case">{pricesCount} цін</span>}
                </div>
                <div className="flex items-center gap-2">
                  {pricesCount > 0 && (
                    <button onClick={async () => {
                      const r = await api.get(`/documents/client/${client.id}/pricelist`, { params: { form }, responseType: 'blob' });
                      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
                      window.open(url, '_blank');
                      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
                    }}
                      className="text-xs text-gray-500 hover:text-gray-700 font-semibold flex items-center gap-1 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors">
                      🖨 PDF
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => setShowCopyModal(true)}
                      className="text-xs text-blue-500 hover:text-blue-700 font-semibold flex items-center gap-1 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                      📋 Скопіювати від...
                    </button>
                  )}
                </div>
              </div>

              {/* Перемикач форми */}
              {!isInspector && (
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm mb-4">
                  {(['FORM_1', 'FORM_2'] as Form[]).map((f) => (
                    <button key={f} onClick={() => setForm(f)}
                      className={`flex-1 py-1.5 transition-colors ${form === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                      {f === 'FORM_1' ? '🏦 Форма 1 (безнал)' : '💵 Форма 2 (готівка)'}
                    </button>
                  ))}
                </div>
              )}

              {pricesLoading ? (
                <div className="text-center text-gray-400 py-6">Завантаження...</div>
              ) : (
                <div className="space-y-2">
                  {products.map((product: any) => {
                    const price = Number(prices[product.id] || 0);
                    return (
                      <div key={product.id}
                        className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${price > 0 ? 'bg-green-50 border border-green-100' : 'bg-gray-50'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-700 truncate">{product.name}</div>
                          <div className="text-xs text-gray-400">/{product.unit}</div>
                        </div>
                        {isAdmin ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1">
                              <input type="number" step="0.01" min="0"
                                value={prices[product.id] || ''}
                                onChange={(e) => setPrices(prev => ({ ...prev, [product.id]: e.target.value }))}
                                placeholder="0.00"
                                className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                              <span className="text-xs text-gray-500">₴</span>
                            </div>
                            {price > 0 && (
                              <div className="text-right">
                                <div className="text-xs text-gray-400 leading-none">з ПДВ</div>
                                <div className="text-xs font-semibold text-blue-600">{(price * 1.2).toFixed(2)} ₴</div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-right shrink-0">
                            <div className="text-sm font-semibold text-gray-700">
                              {price > 0 ? `${price.toFixed(2)} ₴` : '—'}
                            </div>
                            {price > 0 && (
                              <div className="text-xs text-gray-400">з ПДВ: <span className="text-blue-600 font-semibold">{(price * 1.2).toFixed(2)} ₴</span></div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {error && <div className="mt-3 text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</div>}

              {isAdmin && (
                <button onClick={handleSavePrices} disabled={saving}
                  className={`w-full mt-3 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50 transition-colors font-medium ${saved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {saving ? 'Збереження...' : saved ? '✓ Збережено' : 'Зберегти прайс'}
                </button>
              )}
            </div>
          </div>

          {/* Кнопки */}
          <div className="p-4 border-t shrink-0 flex gap-2">
            {isAdmin && (
              <button onClick={onEdit}
                className="flex-1 bg-blue-50 text-blue-700 text-sm px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors">
                ✏️ Редагувати
              </button>
            )}
            <button onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg hover:bg-gray-50">
              Закрити
            </button>
          </div>
        </div>
      </div>

      {showCopyModal && (
        <CopyPriceModal
          targetClient={client}
          form={form}
          allClients={allClients}
          onClose={() => { setShowCopyModal(false); queryClient.invalidateQueries({ queryKey: ['client-prices', client.id] }); }}
        />
      )}
    </>
  );
}

// ─── ClientsPage ──────────────────────────────────────────────────────────────
export default function ClientsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editClient, setEditClient] = useState<Client | undefined>();
  const [detailsClient, setDetailsClient] = useState<Client | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [showBulkPrice, setShowBulkPrice] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients').then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/clients/${id}/toggle`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });

  const isAdmin = user?.role === 'ADMIN';
  const activeClients = clients.filter((c: Client) => c.isActive);
  const inactiveClients = clients.filter((c: Client) => !c.isActive);

  const filtered = clients.filter((c: Client) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.edrpou?.includes(search);
    const matchActive = showInactive ? true : c.isActive;
    return matchSearch && matchActive;
  });

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Клієнти</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Активних: {activeClients.length}
            {inactiveClients.length > 0 && ` · Неактивних: ${inactiveClients.length}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && inactiveClients.length > 0 && (
            <button onClick={() => setShowInactive(v => !v)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${showInactive ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              {showInactive ? 'Сховати архів' : `Архів (${inactiveClients.length})`}
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setShowBulkPrice(true)}
              className="bg-green-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors font-semibold">
              💰 Масова зміна цін
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setShowCreate(true)}
              className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
              + Новий клієнт
            </button>
          )}
        </div>
      </div>

      {/* Пошук */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Пошук за назвою або ЄДРПОУ..."
          className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">×</button>
        )}
      </div>

      {/* Список */}
      {isLoading ? (
        <div className="text-center text-gray-400 py-12">Завантаження...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <div className="text-4xl mb-3">🤝</div>
          <div className="font-medium text-gray-500">{search ? 'Клієнтів не знайдено' : 'Клієнтів ще немає'}</div>
          {isAdmin && !search && (
            <button onClick={() => setShowCreate(true)} className="mt-3 text-blue-500 text-sm hover:text-blue-700">+ Додати першого клієнта</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((client: Client) => (
            <div key={client.id} onClick={() => setDetailsClient(client)}
              className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group ${client.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg ${getAvatarColor(client.name)} flex items-center justify-center text-white font-bold text-sm shrink-0 group-hover:scale-105 transition-transform`}>
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors truncate">{client.name}</span>
                    {!client.isActive && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded shrink-0">архів</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {client.edrpou && <span className="text-xs text-gray-400">📋 {client.edrpou}</span>}
                    {client.contact && <span className="text-xs text-gray-400">📞 {client.contact}</span>}
                  </div>
                  {client.address && <div className="text-xs text-gray-400 mt-0.5 truncate">📍 {client.address}</div>}
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">Натисни для деталей і прайсу</span>
                {isAdmin && (
                  <button onClick={(e) => { e.stopPropagation(); toggleMutation.mutate(client.id); }}
                    className={`text-xs px-2 py-1 rounded-lg transition-colors ${client.isActive ? 'text-red-400 hover:bg-red-50' : 'text-green-500 hover:bg-green-50'}`}>
                    {client.isActive ? 'Деактивувати' : 'Активувати'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <ClientModal onClose={() => setShowCreate(false)} />}
      {editClient && <ClientModal client={editClient} onClose={() => setEditClient(undefined)} />}
      {detailsClient && (
        <ClientDetailsModal
          client={detailsClient}
          allClients={clients}
          onClose={() => setDetailsClient(null)}
          onEdit={() => { setEditClient(detailsClient); setDetailsClient(null); }}
          isAdmin={isAdmin}
        />
      )}
      {showBulkPrice && (
        <BulkPriceModal allClients={activeClients} onClose={() => setShowBulkPrice(false)} />
      )}
    </div>
  );
}