import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { APIProvider, Map as GoogleMap, AdvancedMarker, InfoWindow, useMap, MapMouseEvent } from '@vis.gl/react-google-maps';
import { MarkerClusterer, SuperClusterAlgorithm } from '@googlemaps/markerclusterer';
import api from '@/api/axios';

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string;

// Base city for logistics
const BASE_CITY = { name: 'Хмільник', lat: 49.5597, lng: 27.9392 };

const ALL_OBLASTS = [
  'Вінницька','Волинська','Дніпропетровська','Донецька','Житомирська',
  'Закарпатська','Запорізька','Івано-Франківська','Київська','Кіровоградська',
  'Луганська','Львівська','Миколаївська','Одеська','Полтавська',
  'Рівненська','Сумська','Тернопільська','Харківська','Херсонська',
  'Хмельницька','Черкаська','Чернівецька','Чернігівська','Київ',
];

const CHAIN_COLORS: Record<string, string> = {
  'АТБ':'#e53e3e','Сільпо':'#d69e2e','Новус':'#38a169','METRO':'#3182ce',
  'Фоззі':'#805ad5','Варус':'#dd6b20','Епіцентр':'#2b6cb0','Наш Край':'#2f855a',
  'Клас':'#b7791f','Рукавичка':'#c53030','Велмарт':'#6b46c1','Ашан':'#c05621',
};
function chainColor(c: string | null | undefined) { return c ? (CHAIN_COLORS[c] || '#64748b') : '#94a3b8'; }

function dist(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

interface Store {
  id: string; osmId: string; name: string; lat: number; lng: number;
  chain: string | null; address: string | null; oblast: string; city: string | null;
  phone: string | null; openingHours: string | null; website: string | null;
  rating: number | null; isWorking: boolean; isNew: boolean; notes: string | null;
}

// SVG pin icon — data URI (набагато легший за div, рендериться через GPU)
const PIN_CACHE = new globalThis.Map<string, string>();
function makePinUri(color: string, border: string, scale: number): string {
  const key = `${color}${border}${scale}`;
  if (PIN_CACHE.has(key)) return PIN_CACHE.get(key)!;
  const w = Math.round(22 * scale);
  const h = Math.round(32 * scale);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 22 32"><path d="M11 0C4.9 0 0 4.9 0 11c0 8.3 11 21 11 21S22 19.3 22 11C22 4.9 17.1 0 11 0z" fill="${border}"/><path d="M11 2C6 2 2 6 2 11c0 7.5 9 19 9 19s9-11.5 9-19C20 6 16 2 11 2z" fill="${color}"/><circle cx="11" cy="11" r="4" fill="white" opacity="0.88"/></svg>`;
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  PIN_CACHE.set(key, uri);
  return uri;
}

function makePinImg(s: Store): HTMLImageElement {
  const color = s.isWorking ? '#16a34a' : s.isNew ? '#f97316' : chainColor(s.chain);
  const border = s.isWorking ? '#166534' : s.isNew ? '#9a3412' : '#1e293b';
  const scale = s.isWorking ? 1.15 : s.isNew ? 1.0 : 0.82;
  const img = document.createElement('img');
  img.src = makePinUri(color, border, scale);
  img.width = Math.round(22 * scale);
  img.height = Math.round(32 * scale);
  img.style.cssText = 'display:block;cursor:pointer;';
  return img;
}

/* ── Маркери + кластеризація ── */
function MapMarkers({ stores, onSelect }: { stores: Store[]; onSelect: (s: Store) => void }) {
  const map = useMap();
  const clustererRef = useRef<MarkerClusterer | null>(null);
  // Partners → directly on map (always visible); others → clusterer
  const partnerMarkersRef = useRef(new globalThis.Map<string, google.maps.marker.AdvancedMarkerElement>());
  const otherMarkersRef = useRef(new globalThis.Map<string, google.maps.marker.AdvancedMarkerElement>());
  const markerStateRef = useRef(new globalThis.Map<string, string>());
  const storesRef = useRef<Store[]>([]);
  const [popup, setPopup] = useState<Store | null>(null);

  // Cluster renderer — один раз
  const rendererRef = useRef({
    render: ({ count, position }: { count: number; position: google.maps.LatLngLiteral }) => {
      const size = count > 100 ? 48 : count > 30 ? 40 : count > 10 ? 34 : 28;
      const bg = count > 100 ? '#1e40af' : count > 30 ? '#1d4ed8' : count > 10 ? '#2563eb' : '#3b82f6';
      const el = document.createElement('div');
      el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${bg};color:#fff;font-weight:800;font-size:${size < 34 ? 10 : 12}px;display:flex;align-items:center;justify-content:center;border:3px solid rgba(255,255,255,.8);box-shadow:0 2px 10px rgba(0,0,0,.35);cursor:pointer;letter-spacing:-.5px;`;
      el.textContent = count > 999 ? '1k+' : String(count);
      return new google.maps.marker.AdvancedMarkerElement({ position, content: el });
    },
  });

  // Init clusterer
  useEffect(() => {
    if (!map) return;
    clustererRef.current = new MarkerClusterer({
      map,
      algorithm: new SuperClusterAlgorithm({ radius: 55, maxZoom: 14, minPoints: 3 }),
      renderer: rendererRef.current,
    });
    return () => {
      clustererRef.current?.clearMarkers();
      partnerMarkersRef.current.forEach(m => { m.map = null; });
      otherMarkersRef.current.forEach(m => { m.map = null; });
      partnerMarkersRef.current.clear();
      otherMarkersRef.current.clear();
      markerStateRef.current.clear();
      clustererRef.current = null;
    };
  }, [map]);

  // Sync markers — партнери на карті напряму, решта в clusterer
  useEffect(() => {
    const cl = clustererRef.current;
    if (!cl || !map) return;

    storesRef.current = stores;
    const newIds = new globalThis.Set(stores.map(s => s.id));

    // Remove deleted stores from both groups
    const clusterToRemove: google.maps.marker.AdvancedMarkerElement[] = [];
    otherMarkersRef.current.forEach((m, id) => {
      if (!newIds.has(id)) { clusterToRemove.push(m); otherMarkersRef.current.delete(id); markerStateRef.current.delete(id); }
    });
    partnerMarkersRef.current.forEach((m, id) => {
      if (!newIds.has(id)) { m.map = null; partnerMarkersRef.current.delete(id); markerStateRef.current.delete(id); }
    });
    if (clusterToRemove.length) cl.removeMarkers(clusterToRemove);

    const clusterToAdd: google.maps.marker.AdvancedMarkerElement[] = [];

    stores.forEach(store => {
      const stateKey = `${store.isWorking}:${store.isNew}:${store.chain}`;
      const prevState = markerStateRef.current.get(store.id);
      const wasPartner = partnerMarkersRef.current.has(store.id);
      const wasOther = otherMarkersRef.current.has(store.id);

      // State changed (e.g. isWorking toggled) → move between groups
      if (prevState !== undefined && prevState !== stateKey) {
        const prevWorking = prevState.startsWith('true');
        if (prevWorking && !store.isWorking) {
          // Was partner → move to clusterer
          const m = partnerMarkersRef.current.get(store.id)!;
          m.map = null;
          partnerMarkersRef.current.delete(store.id);
          m.content = makePinImg(store);
          otherMarkersRef.current.set(store.id, m);
          clusterToAdd.push(m);
        } else if (!prevWorking && store.isWorking) {
          // Was other → move to direct map
          const m = otherMarkersRef.current.get(store.id)!;
          cl.removeMarker(m);
          otherMarkersRef.current.delete(store.id);
          m.content = makePinImg(store);
          m.map = map;
          partnerMarkersRef.current.set(store.id, m);
        } else {
          // Same group, just update pin
          const m = (wasPartner ? partnerMarkersRef.current : otherMarkersRef.current).get(store.id);
          if (m) m.content = makePinImg(store);
        }
        markerStateRef.current.set(store.id, stateKey);
        return;
      }

      if (wasPartner || wasOther) return; // already exists, no change

      // New marker
      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: store.lat, lng: store.lng },
        content: makePinImg(store),
        title: store.name,
      });
      marker.addListener('click', () => setPopup(storesRef.current.find(s => s.id === store.id) ?? store));
      markerStateRef.current.set(store.id, stateKey);

      if (store.isWorking) {
        marker.map = map;
        partnerMarkersRef.current.set(store.id, marker);
      } else {
        otherMarkersRef.current.set(store.id, marker);
        clusterToAdd.push(marker);
      }
    });

    if (clusterToAdd.length) cl.addMarkers(clusterToAdd);
  }, [stores, map]);

  return (
    <>
      <AdvancedMarker position={{ lat: BASE_CITY.lat, lng: BASE_CITY.lng }}>
        <div style={{ background: '#1d4ed8', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,.4)', whiteSpace: 'nowrap', border: '2px solid #1e3a8a' }}>
          🏠 {BASE_CITY.name}
        </div>
      </AdvancedMarker>

      {popup && (
        <InfoWindow position={{ lat: popup.lat, lng: popup.lng }} onCloseClick={() => setPopup(null)}>
          <div className="font-sans min-w-[200px] space-y-1.5 p-0.5">
            <div className="font-bold text-gray-800">{popup.name}</div>
            {popup.chain && <span className="text-xs px-2 py-0.5 rounded-full text-white inline-block" style={{ background: chainColor(popup.chain) }}>{popup.chain}</span>}
            {popup.city && <div className="text-xs text-gray-500">📍 {popup.city}, {popup.oblast}</div>}
            {popup.rating && <div className="text-xs text-amber-600 font-medium">⭐ {popup.rating}</div>}
            <div className="text-xs text-blue-500">📏 {dist(BASE_CITY.lat, BASE_CITY.lng, popup.lat, popup.lng).toFixed(0)} км від Хмільника</div>
            {popup.isWorking && <div className="text-xs text-green-700 font-semibold">✓ Партнер</div>}
            {popup.isNew && <div className="text-xs text-orange-600 font-semibold">🆕 Новий</div>}
            <button onClick={() => { onSelect(popup); setPopup(null); }}
              className="mt-1 w-full py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 font-medium">
              Детальніше →
            </button>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

/* ── Модал: додати магазин вручну ── */
function AddStoreModal({ onClose, onSave, initialPos }: { onClose: () => void; onSave: (data: any) => void; initialPos?: { lat: number; lng: number } | null }) {
  const [name, setName] = useState('');
  const [oblast, setOblast] = useState('Вінницька');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [chain, setChain] = useState('');
  const [phone, setPhone] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [lat, setLat] = useState(initialPos ? initialPos.lat.toFixed(6) : '');
  const [lng, setLng] = useState(initialPos ? initialPos.lng.toFixed(6) : '');
  const [geoError, setGeoError] = useState('');

  const geocode = async () => {
    const query = [address, city, oblast, 'Україна'].filter(Boolean).join(', ');
    if (!query.trim()) return;
    setGeocoding(true); setGeoError('');
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_KEY}&language=uk`
      );
      const d = await res.json();
      if (d.status === 'OK' && d.results[0]) {
        setLat(d.results[0].geometry.location.lat.toFixed(6));
        setLng(d.results[0].geometry.location.lng.toFixed(6));
      } else setGeoError('Адресу не знайдено');
    } catch { setGeoError('Помилка геокодування'); }
    finally { setGeocoding(false); }
  };

  const handleSave = () => {
    if (!name.trim() || !lat || !lng) return;
    onSave({ name, oblast, city, address, chain: chain || undefined, phone: phone || undefined, lat: parseFloat(lat), lng: parseFloat(lng) });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-bold text-gray-800">➕ {initialPos ? '📍 Додати магазин' : 'Додати магазин вручну'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
        </div>
        <div className="p-4 space-y-3">
          {initialPos && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
              📍 Координати встановлені з карти — вкажіть назву магазину
            </div>
          )}
          <Field label="Назва *" value={name} onChange={setName} placeholder="АТБ Хмільник" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Область *</label>
              <select value={oblast} onChange={e => setOblast(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {ALL_OBLASTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <Field label="Місто" value={city} onChange={setCity} placeholder="Хмільник" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Field label="Адреса" value={address} onChange={setAddress} placeholder="вул. Незалежності 10" />
            </div>
            <div className="pt-5">
              <button onClick={geocode} disabled={geocoding}
                className="px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
                {geocoding ? '⏳' : '📍 Знайти'}
              </button>
            </div>
          </div>
          {geoError && <p className="text-xs text-red-500">{geoError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Широта *" value={lat} onChange={setLat} placeholder="49.5597" />
            <Field label="Довгота *" value={lng} onChange={setLng} placeholder="27.9392" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Мережа" value={chain} onChange={setChain} placeholder="АТБ" />
            <Field label="Телефон" value={phone} onChange={setPhone} placeholder="+38..." />
          </div>
        </div>
        <div className="p-4 border-t flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Скасувати</button>
          <button onClick={handleSave} disabled={!name.trim() || !lat || !lng}
            className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-40">
            Зберегти
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );
}

/* ── Модал: логістика ── */
function LogisticsModal({ stores, onClose }: { stores: Store[]; onClose: () => void }) {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!result) analyze(); }, []);  // eslint-disable-line

  const analyze = async () => {
    if (!ANTHROPIC_KEY) return;
    setLoading(true);
    const partners = stores.filter(s => s.isWorking);
    if (partners.length === 0) { setResult('Немає магазинів-партнерів для побудови маршруту.'); setLoading(false); return; }

    const list = partners.map(s => {
      const d = dist(BASE_CITY.lat, BASE_CITY.lng, s.lat, s.lng);
      return `- ${s.name} (${s.city || s.oblast}, ${d.toFixed(0)} км від Хмільника, координати: ${s.lat.toFixed(3)},${s.lng.toFixed(3)})`;
    }).join('\n');

    const prompt = `Ти — логіст для рибного виробництва у Хмільнику (Вінницька обл.). Треба розвезти продукцію по магазинах-партнерах.

Список партнерів (${partners.length} магазинів):
${list}

Побудуй оптимальний розклад на тиждень (пн–пт). Для кожного дня:
1. Назви маршрут: Хмільник → [міста по черзі] → Хмільник
2. Вкажи приблизний km
3. Коротко поясни чому така послідовність

Критерії: мінімум пробігу, не більше 5-6 зупинок на день, групуй географічно близькі магазини. Якщо магазинів менше ніж 5 днів — використовуй менше днів.`;

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
      });
      const d = await resp.json();
      setResult(d.content?.[0]?.text || 'Помилка');
    } catch { setResult('Помилка AI'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-2xl">
          <div>
            <h2 className="font-bold text-white">🚚 Логістика доставки</h2>
            <p className="text-blue-100 text-xs mt-0.5">База: Хмільник · {stores.filter(s => s.isWorking).length} партнерів</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="flex gap-1">{[0,1,2].map(i => <div key={i} className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}</div>
              <p className="text-sm text-gray-500">AI будує оптимальні маршрути...</p>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">{result}</pre>
            </div>
          )}
        </div>
        <div className="p-4 border-t flex gap-2">
          <button onClick={analyze} disabled={loading}
            className="px-4 py-2 border border-blue-300 text-blue-700 rounded-xl text-sm hover:bg-blue-50 disabled:opacity-40">
            🔄 Перерахувати
          </button>
          <button onClick={onClose} className="ml-auto px-4 py-2 bg-gray-100 rounded-xl text-sm text-gray-600 hover:bg-gray-200">
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Головна сторінка ── */
export default function StoresPage() {
  const qc = useQueryClient();
  const [selectedOblasts, setSelectedOblasts] = useState<string[]>(['Вінницька']);
  const [statusFilter, setStatusFilter] = useState<'all'|'working'|'new'|'not_working'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [notesEdit, setNotesEdit] = useState('');
  const [showOblastPicker, setShowOblastPicker] = useState(false);
  const [oblastBtnRect, setOblastBtnRect] = useState<DOMRect | null>(null);
  const [syncingOblast, setSyncingOblast] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [view, setView] = useState<'map'|'list'>('map');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addPosition, setAddPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [showLogistics, setShowLogistics] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const oblastBtnRef = useRef<HTMLButtonElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (selectedOblasts.length) p.oblasts = selectedOblasts.join(',');
    if (statusFilter === 'working') p.isWorking = 'true';
    if (statusFilter === 'not_working') p.isWorking = 'false';
    if (statusFilter === 'new') p.isNew = 'true';
    if (debouncedSearch) p.search = debouncedSearch;
    return p;
  }, [selectedOblasts, statusFilter, debouncedSearch]);

  const { data: stores = [], isLoading } = useQuery<Store[]>({
    queryKey: ['stores', params],
    queryFn: () => api.get('/stores', { params }).then(r => r.data),
  });
  const { data: stats } = useQuery({
    queryKey: ['store-stats'],
    queryFn: () => api.get('/stores/stats').then(r => r.data),
  });

  const invalidate = () => { ['stores','store-stats'].forEach(k => qc.invalidateQueries({ queryKey: [k] })); };

  const toggleMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => api.patch(`/stores/${id}/toggle`, {}).then(r => r.data),
    onSuccess: (data) => { invalidate(); setSelectedStore(prev => prev?.id === data.id ? data : prev); },
  });
  const notesMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => api.patch(`/stores/${id}/notes`, { notes }).then(r => r.data),
    onSuccess: () => invalidate(),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/stores/${id}`),
    onSuccess: () => { invalidate(); setSelectedStore(null); setConfirmDeleteId(null); },
  });
  const addMutation = useMutation({
    mutationFn: (data: any) => api.post('/stores/manual', data).then(r => r.data),
    onSuccess: () => { invalidate(); setShowAddModal(false); },
  });

  const handleSync = async (oblast: string) => {
    setSyncingOblast(oblast); setSyncResult(null);
    try {
      await api.post('/stores/sync', { oblast });
      const poll = async () => {
        try {
          const { data: s } = await api.get(`/stores/sync-status/${encodeURIComponent(oblast)}`);
          if (s.status === 'done') {
            setSyncResult(`✅ ${oblast}: +${s.result.created} нових`);
            // Автоматично показуємо щойно синхронізовану область
            setSelectedOblasts(prev => prev.includes(oblast) ? prev : [...prev, oblast]);
            invalidate(); setSyncingOblast(null);
          } else if (s.status === 'error') {
            setSyncResult(`❌ ${s.error}`); setSyncingOblast(null);
          } else setTimeout(poll, 3000);
        } catch { setSyncResult('❌ Помилка статусу'); setSyncingOblast(null); }
      };
      setTimeout(poll, 3000);
    } catch (e: any) { setSyncResult(`❌ ${e.response?.data?.message || e.message}`); setSyncingOblast(null); }
  };

  const toggleOblast = useCallback((o: string) =>
    setSelectedOblasts(p => p.includes(o) ? p.filter(x => x !== o) : [...p, o]), []);

  const coveragePct = stats?.total > 0 ? Math.round((stats.working / stats.total) * 100) : 0;

  // Partners sorted by distance for logistics hint
  const nearestPartners = useMemo(() =>
    stores.filter(s => s.isWorking)
      .map(s => ({ ...s, distKm: dist(BASE_CITY.lat, BASE_CITY.lng, s.lat, s.lng) }))
      .sort((a, b) => a.distKm - b.distKm)
      .slice(0, 5),
    [stores]);

  return (
    <APIProvider apiKey={GOOGLE_MAPS_KEY} language="uk" region="UA">
      <div className="flex flex-col bg-slate-50" style={{ height: 'calc(100vh - 56px)' }}>

        {/* ── Шапка ── */}
        <div className="bg-white border-b border-gray-100 flex-shrink-0 relative z-10 shadow-sm">

          {/* Рядок 1: заголовок + кнопки */}
          <div className="px-4 pt-3 pb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-base font-bold text-gray-800">🏪 Магазини</h1>
                <p className="text-xs text-gray-400">база: Хмільник</p>
              </div>
              {stats && (
                <div className="hidden sm:flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                    <span className="text-xs text-gray-400">Всього:</span>
                    <span className="text-xs font-bold text-gray-700">{stats.total}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1">
                    <span className="text-xs text-gray-400">Партнери:</span>
                    <span className="text-xs font-bold text-green-700">{stats.working}</span>
                  </div>
                  {stats.isNew > 0 && (
                    <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1 animate-pulse">
                      <span className="text-xs font-bold text-orange-600">🆕 {stats.isNew}</span>
                    </div>
                  )}
                  {stats.total > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${coveragePct}%` }} />
                      </div>
                      <span className="text-xs text-green-600 font-semibold">{coveragePct}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button onClick={() => setShowLogistics(true)}
                disabled={stores.filter(s => s.isWorking).length === 0}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-xs rounded-lg hover:opacity-90 disabled:opacity-40 font-medium shadow-sm">
                🚚 Логістика
              </button>
              <button onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 font-medium shadow-sm">
                ➕ Додати
              </button>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                {(['map','list'] as const).map(v => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-2.5 py-1.5 font-medium ${view === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                    {v === 'map' ? '🗺' : '≡'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Рядок 2: фільтри */}
          <div className="px-4 pb-2 flex flex-wrap gap-2 items-center border-t border-gray-50 pt-2">
            {/* Oblast */}
            <button ref={oblastBtnRef}
              onClick={() => { if (!showOblastPicker && oblastBtnRef.current) setOblastBtnRect(oblastBtnRef.current.getBoundingClientRect()); setShowOblastPicker(v => !v); }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${selectedOblasts.length ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              📍 {selectedOblasts.length ? selectedOblasts.slice(0,2).join(', ') + (selectedOblasts.length > 2 ? ` +${selectedOblasts.length-2}` : '') : 'Всі обл.'} ▾
            </button>

            {/* Status */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs shadow-sm">
              {[['all','Всі'],['working','✓ Мої'],['new','🆕 Нові'],['not_working','Решта']] .map(([v,l]) => (
                <button key={v} onClick={() => setStatusFilter(v as any)}
                  className={`px-2.5 py-1.5 font-medium whitespace-nowrap ${statusFilter === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                  {l}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative ml-auto">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 text-xs">🔍</span>
              <input type="text" placeholder="Пошук..." value={search} onChange={e => setSearch(e.target.value)}
                className="pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 w-40 bg-white" />
              {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">×</button>}
            </div>
          </div>

          {/* Рядок 3: sync */}
          <div className="px-4 pb-2.5 flex flex-wrap gap-1.5 items-center border-t border-gray-50 pt-2">
            <span className="text-xs text-gray-300 mr-1">Оновити з Google:</span>
            {['Вінницька','Хмельницька','Житомирська','Київська','Черкаська','Полтавська'].map(oblast => (
              <button key={oblast} onClick={() => handleSync(oblast)} disabled={syncingOblast !== null}
                className={`px-2 py-1 rounded-md text-xs font-medium border disabled:opacity-40 transition-all ${syncingOblast === oblast ? 'bg-blue-50 border-blue-200 text-blue-600 animate-pulse' : 'border-gray-200 text-gray-500 bg-white hover:bg-gray-50 hover:border-gray-300'}`}>
                {syncingOblast === oblast ? '⏳' : '↓'} {oblast}
              </button>
            ))}
            {syncResult && <span className={`text-xs font-medium ${syncResult.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>{syncResult}</span>}
          </div>
        </div>

        {/* Oblast picker portal */}
        {showOblastPicker && oblastBtnRect && createPortal(
          <>
            <div className="fixed inset-0 z-[99998]" onClick={() => setShowOblastPicker(false)} />
            <div style={{ position: 'fixed', top: oblastBtnRect.bottom + 6, left: oblastBtnRect.left, zIndex: 99999 }}
              className="bg-white border border-gray-200 rounded-xl shadow-2xl p-3 w-72">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-gray-700">Оберіть області</span>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => setSelectedOblasts([...ALL_OBLASTS])} className="text-blue-600 hover:underline">Всі</button>
                  <button onClick={() => setSelectedOblasts([])} className="text-red-400 hover:underline">Жодної</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-0.5 max-h-56 overflow-y-auto">
                {ALL_OBLASTS.map(oblast => (
                  <label key={oblast} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-gray-50 text-gray-600">
                    <input type="checkbox" checked={selectedOblasts.includes(oblast)} onChange={() => toggleOblast(oblast)} className="rounded accent-blue-600" />
                    {oblast}
                  </label>
                ))}
              </div>
              <button onClick={() => setShowOblastPicker(false)} className="mt-2 w-full py-1.5 text-xs bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">Застосувати</button>
            </div>
          </>,
          document.body,
        )}

        {/* ── Контент ── */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* MAP */}
          {view === 'map' && (
            <div className="flex-1 relative">
              {isLoading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex items-center justify-center">
                  <div className="bg-white rounded-xl shadow-lg px-4 py-3 text-sm text-gray-500">Завантаження...</div>
                </div>
              )}
              <GoogleMap mapId="fish-erp-map" defaultCenter={{ lat: 49.2, lng: 28.5 }} defaultZoom={8}
                style={{ width: '100%', height: '100%' }} gestureHandling="greedy"
                mapTypeControl={false} streetViewControl={false}
                onDblclick={(e: MapMouseEvent) => {
                  const lat = e.detail.latLng?.lat;
                  const lng = e.detail.latLng?.lng;
                  if (lat != null && lng != null) {
                    setAddPosition({ lat, lng });
                    setShowAddModal(true);
                  }
                }}>
                <MapMarkers stores={stores} onSelect={setSelectedStore} />
              </GoogleMap>

              {/* Legenda */}
              <div className="absolute bottom-6 left-4 bg-white/95 backdrop-blur-sm rounded-xl shadow border border-gray-100 p-3 text-xs z-10">
                <div className="font-semibold text-gray-600 mb-2 text-xs uppercase tracking-wide">Легенда</div>
                {[['#16a34a','Партнер'],['#f97316','Новий'],['#64748b','Решта'],['#1d4ed8','База (Хмільник)']].map(([c,l]) => (
                  <div key={l} className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full" style={{ background: c }} />
                    <span className="text-gray-500">{l}</span>
                  </div>
                ))}
                <div className="border-t border-gray-100 mt-2 pt-2 text-gray-300">{stores.length} на карті</div>
              </div>

              {/* Nearest partners hint */}
              {nearestPartners.length > 0 && statusFilter !== 'not_working' && (
                <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-xl shadow border border-gray-100 p-3 text-xs z-10 max-w-[180px]">
                  <div className="font-semibold text-gray-600 mb-2 text-xs uppercase tracking-wide">Найближчі</div>
                  {nearestPartners.map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-2 mb-1 cursor-pointer hover:text-blue-600" onClick={() => setSelectedStore(s)}>
                      <span className="truncate text-gray-600">{s.name}</span>
                      <span className="text-gray-300 shrink-0">{s.distKm.toFixed(0)}км</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* LIST */}
          {view === 'list' && (
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="text-center py-12 text-gray-400">Завантаження...</div>
              ) : stores.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-5xl mb-3">🏪</div>
                  <p className="text-gray-500 font-medium">Магазинів не знайдено</p>
                  <p className="text-gray-400 text-sm mt-1">Оновити з Google або змінити фільтри</p>
                  <button onClick={() => setShowAddModal(true)} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700">
                    ➕ Додати вручну
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {stores.map(store => (
                    <StoreCard key={store.id} store={store}
                      onToggle={id => toggleMutation.mutate({ id })}
                      onSelect={() => setSelectedStore(store)}
                      onDelete={() => setConfirmDeleteId(store.id)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Detail panel */}
          {selectedStore && (
            <div className="w-80 flex-shrink-0 bg-white border-l border-gray-100 flex flex-col shadow-xl overflow-y-auto">
              <div className="p-4 border-b">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-800 text-sm leading-tight">{selectedStore.name}</div>
                    {selectedStore.chain && (
                      <span className="mt-1 text-xs px-2 py-0.5 rounded-full text-white inline-block font-medium"
                        style={{ background: chainColor(selectedStore.chain) }}>
                        {selectedStore.chain}
                      </span>
                    )}
                    <div className="text-xs text-blue-500 mt-1">
                      📏 {dist(BASE_CITY.lat, BASE_CITY.lng, selectedStore.lat, selectedStore.lng).toFixed(0)} км від Хмільника
                    </div>
                  </div>
                  <button onClick={() => setSelectedStore(null)} className="text-gray-300 hover:text-gray-600 text-xl">×</button>
                </div>
              </div>

              <div className="p-4 space-y-3 flex-1">
                <button onClick={() => toggleMutation.mutate({ id: selectedStore.id })}
                  className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${selectedStore.isWorking ? 'bg-green-500 text-white hover:bg-red-500' : 'bg-slate-100 text-gray-600 border border-slate-200 hover:bg-green-50 hover:text-green-700 hover:border-green-300'}`}>
                  {selectedStore.isWorking ? '✓ Партнер · натисни щоб зняти' : '+ Додати до партнерів'}
                </button>

                {selectedStore.isNew && (
                  <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700">
                    🆕 Новий — ще не опрацьовано
                  </div>
                )}

                {selectedStore.rating && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    <span className="text-amber-500 text-base">⭐</span>
                    <div>
                      <div className="text-xs font-semibold text-amber-700">{selectedStore.rating.toFixed(1)} / 5</div>
                      <div className="flex gap-0.5 mt-0.5">
                        {[1,2,3,4,5].map(i => <div key={i} className={`w-2.5 h-2.5 rounded-sm ${i <= Math.round(selectedStore.rating!) ? 'bg-amber-400' : 'bg-amber-100'}`} />)}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 text-xs">
                  {[
                    ['📍', 'Область', selectedStore.oblast],
                    selectedStore.city && ['🏘', 'Місто', selectedStore.city],
                    selectedStore.address && ['🏠', 'Адреса', selectedStore.address],
                    selectedStore.phone && ['📞', 'Телефон', selectedStore.phone],
                    selectedStore.openingHours && ['🕐', 'Години', selectedStore.openingHours],
                  ].filter(Boolean).map((row: any) => (
                    <div key={row[1]} className="flex gap-2 text-gray-600">
                      <span className="w-4 shrink-0">{row[0]}</span>
                      <div><span className="text-gray-300">{row[1]}: </span>{row[2]}</div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1.5">Нотатки</label>
                  <textarea
                    value={notesEdit !== '' ? notesEdit : (selectedStore.notes || '')}
                    onChange={e => setNotesEdit(e.target.value)}
                    onFocus={() => setNotesEdit(selectedStore.notes || '')}
                    placeholder="Контакт, статус переговорів..."
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-slate-50" />
                  <button onClick={() => { notesMutation.mutate({ id: selectedStore.id, notes: notesEdit }); setSelectedStore(p => p ? { ...p, notes: notesEdit } : null); setNotesEdit(''); }}
                    disabled={notesEdit === '' || notesMutation.isPending}
                    className="mt-1 w-full py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 font-medium">
                    Зберегти нотатки
                  </button>
                </div>

                <div className="flex gap-2 pt-1">
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedStore.name)}&query_place_id=${selectedStore.osmId}`}
                    target="_blank" rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50">
                    🗺 Google Maps
                  </a>
                  <button onClick={() => setConfirmDeleteId(selectedStore.id)}
                    className="px-3 py-1.5 border border-red-200 rounded-lg text-xs text-red-500 hover:bg-red-50">
                    🗑 Видалити
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Confirm delete ── */}
        {confirmDeleteId && createPortal(
          <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-sm w-full">
              <div className="text-2xl text-center mb-2">🗑</div>
              <h3 className="font-bold text-gray-800 text-center mb-1">Видалити магазин?</h3>
              <p className="text-sm text-gray-500 text-center mb-4">Він зникне з карти і зі статистики</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Скасувати</button>
                <button onClick={() => deleteMutation.mutate(confirmDeleteId)} disabled={deleteMutation.isPending}
                  className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                  Видалити
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

        {/* Modals */}
        {showAddModal && <AddStoreModal onClose={() => { setShowAddModal(false); setAddPosition(null); }} onSave={data => addMutation.mutate(data)} initialPos={addPosition} />}
        {showLogistics && <LogisticsModal stores={stores} onClose={() => setShowLogistics(false)} />}
      </div>
    </APIProvider>
  );
}

function StoreCard({ store, onToggle, onSelect, onDelete }: { store: Store; onToggle: (id: string) => void; onSelect: () => void; onDelete: () => void }) {
  const km = dist(BASE_CITY.lat, BASE_CITY.lng, store.lat, store.lng);
  return (
    <div onClick={onSelect}
      className={`bg-white rounded-xl border p-3 cursor-pointer group hover:shadow-md hover:-translate-y-0.5 transition-all ${store.isWorking ? 'border-green-200 shadow-sm' : store.isNew ? 'border-orange-200' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-800 text-sm truncate">{store.name}</div>
          <div className="text-xs text-gray-400">{store.city || store.oblast} · {km.toFixed(0)}км</div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all text-xs">
            ✕
          </button>
          <button onClick={e => { e.stopPropagation(); onToggle(store.id); }}
            className={`w-7 h-7 rounded-full flex items-center justify-center border-2 shrink-0 transition-all text-xs font-bold ${store.isWorking ? 'bg-green-500 border-green-500 text-white' : 'border-gray-200 hover:border-green-400 hover:bg-green-50'}`}>
            {store.isWorking ? '✓' : ''}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {store.chain && <span className="px-1.5 py-0.5 rounded-full text-xs font-medium text-white" style={{ background: chainColor(store.chain) }}>{store.chain}</span>}
        {store.isNew && <span className="px-1.5 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700">🆕</span>}
        {store.rating && <span className="text-xs text-amber-400">⭐{store.rating}</span>}
      </div>
      {store.notes && <div className="mt-2 text-xs text-gray-400 bg-slate-50 rounded px-2 py-1 truncate">💬 {store.notes}</div>}
    </div>
  );
}
