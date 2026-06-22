import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { useAuthStore } from '@/store/auth';

interface Ingredient { name: string; amount: string }
interface RecipeStage {
  id: string;
  recipeSheetId: string;
  name: string;
  content: string | null;
  tempInfo: string | null;
  timeInfo: string | null;
  ingredients: Ingredient[] | null;
  isCriticalPoint: boolean;
  sortOrder: number;
  updatedAt: string;
}
interface RecipeSheet {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  sortOrder: number;
  stages?: RecipeStage[];
  _count?: { stages: number };
}

const STAGE_TEMPLATES = ['Розморожування', 'Патрання', 'Засолення', 'Заправлення', 'Копчення', 'Пакування', 'Заморожування'];

// Базові пропорції для деяких етапів — підставляються одразу при створенні
const DEFAULT_INGREDIENTS: Record<string, Ingredient[]> = {
  'Засолення': [{ name: 'Сіль', amount: '' }, { name: 'Вода', amount: '' }],
  'Заправлення': [{ name: 'Сіль', amount: '' }, { name: 'Вода', amount: '' }, { name: 'Оцет', amount: '' }],
};

// Підказки для швидкого додавання інгредієнта "за потреби" (напр. Матьє)
function getIngredientSuggestions(stageName: string): string[] {
  const lower = stageName.toLowerCase();
  if (lower.includes('засол')) return ['Сіль', 'Вода', 'Матьє'];
  if (lower.includes('заправ')) return ['Сіль', 'Вода', 'Оцет', 'Матьє'];
  return [];
}
const ICON_OPTIONS = ['🐟', '🐠', '🦐', '🦑', '🦞', '🐡', '🦀', '🐙'];

// ─── Rich Text Editor (без зовнішніх залежностей) ────────────────────────────
function RichTextEditor({ initialValue, onChange }: { initialValue: string; onChange: (html: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = initialValue || '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInput = () => onChange(editorRef.current?.innerHTML || '');

  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    handleInput();
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/recipes/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      editorRef.current?.focus();
      document.execCommand('insertHTML', false, `<img src="${res.data.url}" style="max-width:420px;width:100%;border-radius:12px;margin:8px 0;" />`);
      handleInput();
    } catch {
      alert('Помилка завантаження зображення');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const ToolBtn = ({ onClick, children, title }: { onClick: () => void; children: React.ReactNode; title: string }) => (
    <button type="button" onClick={onClick} title={title}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm text-gray-600 hover:bg-gray-100 transition-colors font-medium">
      {children}
    </button>
  );

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50/70 flex-wrap">
        <ToolBtn title="Заголовок" onClick={() => exec('formatBlock', '<h3>')}><b>H</b></ToolBtn>
        <ToolBtn title="Жирний" onClick={() => exec('bold')}><b>B</b></ToolBtn>
        <ToolBtn title="Курсив" onClick={() => exec('italic')}><i>I</i></ToolBtn>
        <ToolBtn title="Підкреслення" onClick={() => exec('underline')}><u>U</u></ToolBtn>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <ToolBtn title="Маркований список" onClick={() => exec('insertUnorderedList')}>•≡</ToolBtn>
        <ToolBtn title="Нумерований список" onClick={() => exec('insertOrderedList')}>1≡</ToolBtn>
        <ToolBtn title="Цитата" onClick={() => exec('formatBlock', '<blockquote>')}>❝</ToolBtn>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <ToolBtn title="Зображення" onClick={() => fileInputRef.current?.click()}>
          {uploading ? '⏳' : '🖼️'}
        </ToolBtn>
        <ToolBtn title="Очистити форматування" onClick={() => exec('removeFormat')}>⌫</ToolBtn>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        className="prose-recipe min-h-[260px] max-h-[55vh] overflow-y-auto px-4 py-3 text-sm text-gray-700 focus:outline-none"
        style={{ lineHeight: 1.6 }}
        suppressContentEditableWarning
      />
    </div>
  );
}

// ─── Модал створення/редагування типу сировини ───────────────────────────────
function SheetModal({ sheet, onClose }: { sheet?: RecipeSheet; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(sheet?.name || '');
  const [icon, setIcon] = useState(sheet?.icon || '🐟');
  const [description, setDescription] = useState(sheet?.description || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) return setError('Вкажіть назву');
    setLoading(true); setError('');
    try {
      if (sheet) {
        await api.patch(`/recipes/${sheet.id}`, { name, icon, description: description || undefined });
      } else {
        await api.post('/recipes', { name, icon, description: description || undefined });
      }
      queryClient.invalidateQueries({ queryKey: ['recipe-sheets'] });
      if (sheet) queryClient.invalidateQueries({ queryKey: ['recipe-sheet', sheet.id] });
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Помилка збереження');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-cyan-600 to-blue-600">
          <h2 className="font-bold text-white">{sheet ? '✏️ Редагувати' : '➕ Новий тип сировини'}</h2>
        </div>
        <div className="p-5 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Іконка</label>
            <div className="flex gap-1.5 flex-wrap">
              {ICON_OPTIONS.map((ic) => (
                <button key={ic} onClick={() => setIcon(ic)}
                  className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border-2 transition-all ${icon === ic ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Назва *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Скумбрія"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Короткий опис</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Холодного копчення, в/у..."
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {error && <div className="text-red-500 text-sm bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">⚠️ {error}</div>}
        </div>
        <div className="p-5 pt-0 flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50">Скасувати</button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 bg-blue-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-semibold">
            {loading ? 'Зберігаю...' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Сторінка ─────────────────────────────────────────────────────────────────
export default function RecipesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [editSheet, setEditSheet] = useState<RecipeSheet | undefined>(undefined);
  const [confirmDeleteSheet, setConfirmDeleteSheet] = useState<RecipeSheet | null>(null);
  const [confirmDeleteStage, setConfirmDeleteStage] = useState<RecipeStage | null>(null);
  const [newStageName, setNewStageName] = useState('');
  const [showAddStage, setShowAddStage] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [draftContent, setDraftContent] = useState('');
  const [draftTemp, setDraftTemp] = useState('');
  const [draftTime, setDraftTime] = useState('');
  const [draftIngredients, setDraftIngredients] = useState<Ingredient[]>([]);
  const [draftCritical, setDraftCritical] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const { data: sheets = [] } = useQuery<RecipeSheet[]>({
    queryKey: ['recipe-sheets'],
    queryFn: () => api.get('/recipes').then((r) => r.data),
  });

  const { data: activeSheet } = useQuery<RecipeSheet>({
    queryKey: ['recipe-sheet', selectedSheetId],
    queryFn: () => api.get(`/recipes/${selectedSheetId}`).then((r) => r.data),
    enabled: !!selectedSheetId,
  });

  const stages = activeSheet?.stages || [];
  const selectedStage = useMemo(() => stages.find((s) => s.id === selectedStageId) || null, [stages, selectedStageId]);
  const [editMode, setEditMode] = useState(false);

  // При зміні етапу — підвантажуємо чернетку з його даних
  useEffect(() => {
    if (selectedStage) {
      setDraftContent(selectedStage.content || '');
      setDraftTemp(selectedStage.tempInfo || '');
      setDraftTime(selectedStage.timeInfo || '');
      setDraftIngredients(selectedStage.ingredients || []);
      setDraftCritical(selectedStage.isCriticalPoint);
      setDirty(false);
      // Якщо етап ще порожній — одразу відкриваємо редактор, інакше показуємо красивий перегляд
      setEditMode(!selectedStage.content?.trim());
    }
  }, [selectedStage?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Автовибір першого етапу при зміні листа
  useEffect(() => {
    if (activeSheet?.stages?.length && !activeSheet.stages.find((s) => s.id === selectedStageId)) {
      setSelectedStageId(activeSheet.stages[0].id);
    }
    if (activeSheet && activeSheet.stages?.length === 0) setSelectedStageId(null);
  }, [activeSheet]); // eslint-disable-line react-hooks/exhaustive-deps

  const createStageMutation = useMutation({
    mutationFn: (payload: { name: string; ingredients?: Ingredient[] }) =>
      api.post(`/recipes/${selectedSheetId}/stages`, payload).then((r) => r.data),
    onSuccess: (newStage) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-sheet', selectedSheetId] });
      queryClient.invalidateQueries({ queryKey: ['recipe-sheets'] });
      setSelectedStageId(newStage.id);
      setShowAddStage(false);
      setNewStageName('');
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: (payload: { id: string; data: Partial<RecipeStage> }) =>
      api.patch(`/recipes/stages/${payload.id}`, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe-sheet', selectedSheetId] });
      setDirty(false);
      setSavedFlash(true);
      setEditMode(false);
      setTimeout(() => setSavedFlash(false), 1800);
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/recipes/stages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe-sheet', selectedSheetId] });
      queryClient.invalidateQueries({ queryKey: ['recipe-sheets'] });
      setConfirmDeleteStage(null);
      setSelectedStageId(null);
    },
  });

  const deleteSheetMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/recipes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe-sheets'] });
      setConfirmDeleteSheet(null);
      setSelectedSheetId(null);
    },
  });

  const handleSaveStage = () => {
    if (!selectedStage) return;
    updateStageMutation.mutate({
      id: selectedStage.id,
      data: {
        content: draftContent, tempInfo: draftTemp, timeInfo: draftTime,
        ingredients: draftIngredients.filter((i) => i.name.trim()),
        isCriticalPoint: draftCritical,
      },
    });
  };

  const handleCancelEdit = () => {
    if (!selectedStage) return;
    setDraftContent(selectedStage.content || '');
    setDraftTemp(selectedStage.tempInfo || '');
    setDraftTime(selectedStage.timeInfo || '');
    setDraftIngredients(selectedStage.ingredients || []);
    setDraftCritical(selectedStage.isCriticalPoint);
    setDirty(false);
    setEditMode(false);
  };

  const updateIngredient = (idx: number, key: keyof Ingredient, val: string) => {
    setDraftIngredients((prev) => prev.map((ing, i) => (i === idx ? { ...ing, [key]: val } : ing)));
    setDirty(true);
  };
  const removeIngredient = (idx: number) => {
    setDraftIngredients((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };
  const addIngredient = (name = '') => {
    setDraftIngredients((prev) => [...prev, { name, amount: '' }]);
    setDirty(true);
  };

  const usedStageNames = new Set(stages.map((s) => s.name));
  const availableTemplates = STAGE_TEMPLATES.filter((t) => !usedStageNames.has(t));

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      {/* Шапка */}
      <div className="bg-gradient-to-br from-slate-50 via-white to-cyan-50/40 rounded-2xl sm:rounded-3xl border border-gray-100 p-3.5 sm:p-5 shadow-sm mb-3 sm:mb-4 shrink-0">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <button onClick={() => setMobileSidebarOpen(true)}
            className="w-9 h-9 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-lg shrink-0 shadow-sm transition-colors">
            ☰
          </button>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-lg sm:text-xl shadow-md shadow-cyan-200 shrink-0">📖</div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-800 tracking-tight">Рецептура</h1>
            <p className="text-xs sm:text-sm text-gray-400 truncate">{sheets.length} типів сировини{activeSheet ? ` · ${activeSheet.icon || '🐟'} ${activeSheet.name}` : ''}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0 relative">
        {/* Затемнення фону при відкритому бургер-меню */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setMobileSidebarOpen(false)} />
        )}

        {/* ── Сайдбар: типи сировини (бургер-меню, оверлей на всіх екранах) ── */}
        <div className={`fixed inset-y-0 left-0 z-50 w-[78vw] max-w-xs sm:max-w-sm shrink-0 flex flex-col bg-white border-r border-gray-100 shadow-2xl overflow-hidden transition-transform duration-200 ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
            <span className="text-sm font-bold text-gray-700">🐟 Типи сировини</span>
            <button onClick={() => setMobileSidebarOpen(false)} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-lg text-gray-400">×</button>
          </div>
          {isAdmin && (
            <div className="p-3 border-b border-gray-100">
              <button onClick={() => { setEditSheet(undefined); setShowSheetModal(true); }}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm px-3 py-2.5 rounded-xl hover:opacity-90 transition-all font-semibold shadow-md shadow-blue-200">
                + Додати тип сировини
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sheets.length === 0 ? (
              <div className="text-center text-gray-400 py-12 px-4">
                <div className="text-4xl mb-2 opacity-40">🐟</div>
                <p className="text-sm">Поки немає жодного типу сировини</p>
              </div>
            ) : sheets.map((sheet) => (
              <div key={sheet.id} onClick={() => { setSelectedSheetId(sheet.id); setMobileSidebarOpen(false); }}
                className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${selectedSheetId === sheet.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                <span className="text-xl shrink-0">{sheet.icon || '🐟'}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold truncate ${selectedSheetId === sheet.id ? 'text-blue-700' : 'text-gray-800'}`}>{sheet.name}</div>
                  <div className="text-[11px] text-gray-400">{sheet._count?.stages ?? 0} етапів</div>
                </div>
                {isAdmin && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); setEditSheet(sheet); setShowSheetModal(true); }}
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all w-6 h-6 rounded-lg hover:bg-gray-200 flex items-center justify-center text-xs shrink-0">✏️</button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteSheet(sheet); }}
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all w-6 h-6 rounded-lg hover:bg-red-100 text-red-400 hover:text-red-600 flex items-center justify-center text-sm shrink-0">×</button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Основний контент ── */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-w-0">
          {!activeSheet ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="text-6xl mb-4 opacity-30">📖</div>
              <p className="font-semibold text-gray-500 text-lg">Оберіть тип сировини зліва</p>
              <p className="text-sm text-gray-400 mt-1">або створіть новий, щоб почати документувати процес обробки</p>
            </div>
          ) : (
            <>
              {/* Заголовок листа */}
              <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center gap-3 shrink-0">
                <span className="text-3xl shrink-0">{activeSheet.icon || '🐟'}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-gray-800 text-lg">{activeSheet.name}</h2>
                  {activeSheet.description && <p className="text-xs text-gray-400">{activeSheet.description}</p>}
                </div>
              </div>

              {/* Таби етапів */}
              <div className="px-4 pt-3 flex items-center gap-1.5 flex-wrap border-b border-gray-100 pb-3 shrink-0">
                {stages.map((stage) => (
                  <button key={stage.id} onClick={() => setSelectedStageId(stage.id)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${selectedStageId === stage.id ? 'bg-gray-900 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                    {stage.isCriticalPoint && <span title="Контрольна точка HACCP">⚠️</span>}
                    {stage.name}
                  </button>
                ))}
                {isAdmin && (!showAddStage ? (
                  <button onClick={() => setShowAddStage(true)}
                    className="px-3 py-1.5 rounded-xl text-sm font-medium text-blue-600 border border-dashed border-blue-300 hover:bg-blue-50 transition-colors">
                    + Етап
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <input value={newStageName} onChange={(e) => setNewStageName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && newStageName.trim()) createStageMutation.mutate({ name: newStageName.trim(), ingredients: DEFAULT_INGREDIENTS[newStageName.trim()] }); }}
                      placeholder="Назва етапу..." autoFocus
                      className="border border-gray-300 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40" />
                    <button onClick={() => newStageName.trim() && createStageMutation.mutate({ name: newStageName.trim(), ingredients: DEFAULT_INGREDIENTS[newStageName.trim()] })}
                      className="text-sm bg-blue-600 text-white px-2.5 py-1.5 rounded-xl hover:bg-blue-700">✓</button>
                    <button onClick={() => { setShowAddStage(false); setNewStageName(''); }}
                      className="text-sm text-gray-400 hover:text-gray-600 px-1">×</button>
                  </div>
                ))}
              </div>
              {isAdmin && showAddStage && availableTemplates.length > 0 && (
                <div className="px-4 pb-2 flex gap-1.5 flex-wrap shrink-0">
                  <span className="text-[11px] text-gray-400 self-center">Швидко:</span>
                  {availableTemplates.map((t) => (
                    <button key={t} onClick={() => createStageMutation.mutate({ name: t, ingredients: DEFAULT_INGREDIENTS[t] })}
                      className="text-[11px] px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                      {t}
                    </button>
                  ))}
                </div>
              )}

              {/* Контент етапу */}
              {!selectedStage ? (
                <div className="flex-1 flex items-center justify-center text-center px-6">
                  <div>
                    <div className="text-5xl mb-3 opacity-30">📝</div>
                    <p className="text-gray-500 font-medium">Додайте перший етап обробки</p>
                    <p className="text-sm text-gray-400 mt-1">наприклад "Розморожування" або "Патрання"</p>
                  </div>
                </div>
              ) : isAdmin && editMode ? (
                <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3.5 sm:space-y-4">
                  {/* Структуровані параметри */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 bg-cyan-50 border border-cyan-100 rounded-xl px-3 py-2 w-full sm:w-44">
                      <span className="text-base shrink-0">🌡️</span>
                      <input value={draftTemp} onChange={(e) => { setDraftTemp(e.target.value); setDirty(true); }}
                        placeholder="Температура, напр. -18°C"
                        className="bg-transparent text-sm text-cyan-700 font-medium focus:outline-none w-full placeholder:text-cyan-300" />
                    </div>
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 w-full sm:w-44">
                      <span className="text-base shrink-0">⏱️</span>
                      <input value={draftTime} onChange={(e) => { setDraftTime(e.target.value); setDirty(true); }}
                        placeholder="Час, напр. 24 години"
                        className="bg-transparent text-sm text-amber-700 font-medium focus:outline-none w-full placeholder:text-amber-300" />
                    </div>
                    <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors w-full sm:w-auto ${draftCritical ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                      <input type="checkbox" checked={draftCritical}
                        onChange={(e) => { setDraftCritical(e.target.checked); setDirty(true); }}
                        className="accent-red-500 w-4 h-4 shrink-0" />
                      <span className={`text-sm font-medium ${draftCritical ? 'text-red-600' : 'text-gray-500'}`}>⚠️ Контрольна точка HACCP</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                    <button onClick={() => setConfirmDeleteStage(selectedStage)}
                      className="text-xs text-red-400 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                      🗑 Видалити етап
                    </button>
                    <button onClick={handleCancelEdit}
                      className="text-sm px-3.5 py-2 rounded-xl font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors">
                      Скасувати
                    </button>
                    <button onClick={handleSaveStage} disabled={!dirty || updateStageMutation.isPending}
                      className={`flex-1 sm:flex-initial text-sm px-4 py-2 rounded-xl font-semibold transition-all shadow-md disabled:opacity-40 disabled:shadow-none ${savedFlash ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-200 hover:opacity-90'}`}>
                      {updateStageMutation.isPending ? 'Зберігаю...' : savedFlash ? '✓ Збережено' : 'Зберегти етап'}
                    </button>
                  </div>

                  {draftCritical && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700 flex items-center gap-2">
                      <span className="text-lg">⚠️</span>
                      <span>Це контрольна точка HACCP — критичний для безпеки продукції етап. Дотримання параметрів обов'язкове.</span>
                    </div>
                  )}

                  {/* Інгредієнти / пропорції */}
                  <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/40">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">🧪 Інгредієнти / пропорції</span>
                      <button onClick={() => addIngredient()}
                        className="text-xs text-blue-600 hover:text-blue-700 font-semibold">+ Додати</button>
                    </div>
                    {draftIngredients.length > 0 && (
                      <div className="space-y-2 mb-2.5">
                        {draftIngredients.map((ing, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 sm:gap-2">
                            <input value={ing.name} onChange={(e) => updateIngredient(idx, 'name', e.target.value)}
                              placeholder="Назва, напр. Сіль"
                              className="flex-1 min-w-0 border border-gray-200 rounded-xl px-2.5 sm:px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                            <input value={ing.amount} onChange={(e) => updateIngredient(idx, 'amount', e.target.value)}
                              placeholder="80 г/л"
                              className="w-20 sm:w-36 shrink-0 border border-gray-200 rounded-xl px-2.5 sm:px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                            <button onClick={() => removeIngredient(idx)}
                              className="text-red-400 hover:text-red-600 text-lg leading-none px-1 shrink-0">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {getIngredientSuggestions(selectedStage.name).filter((s) => !draftIngredients.some((i) => i.name === s)).length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-gray-400">За потреби:</span>
                        {getIngredientSuggestions(selectedStage.name).filter((s) => !draftIngredients.some((i) => i.name === s)).map((s) => (
                          <button key={s} onClick={() => addIngredient(s)}
                            className="text-[11px] px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                            + {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Редактор */}
                  <RichTextEditor
                    key={selectedStage.id}
                    initialValue={selectedStage.content || ''}
                    onChange={(html) => { setDraftContent(html); setDirty(true); }}
                  />

                  <div className="text-[11px] text-gray-300 text-right">
                    Оновлено: {new Date(selectedStage.updatedAt).toLocaleString('uk-UA')}
                  </div>
                </div>
              ) : isAdmin ? (
                // Красивий перегляд для адміна — клік на "Редагувати" відкриває редактор
                <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3.5 sm:space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {selectedStage.tempInfo && (
                      <div className="flex items-center gap-2 bg-cyan-50 border border-cyan-100 rounded-xl px-3 py-2">
                        <span className="text-base">🌡️</span>
                        <span className="text-sm text-cyan-700 font-semibold">{selectedStage.tempInfo}</span>
                      </div>
                    )}
                    {selectedStage.timeInfo && (
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                        <span className="text-base">⏱️</span>
                        <span className="text-sm text-amber-700 font-semibold">{selectedStage.timeInfo}</span>
                      </div>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <button onClick={() => setConfirmDeleteStage(selectedStage)}
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                        🗑 Видалити етап
                      </button>
                      <button onClick={() => setEditMode(true)}
                        className="text-sm px-4 py-2 rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center gap-1.5">
                        ✏️ Редагувати
                      </button>
                    </div>
                  </div>
                  {selectedStage.isCriticalPoint && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700 flex items-center gap-2">
                      <span className="text-lg">⚠️</span>
                      <span>Контрольна точка HACCP — критичний для безпеки продукції етап. Дотримання параметрів обов'язкове.</span>
                    </div>
                  )}
                  {!!selectedStage.ingredients?.length && (
                    <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/40">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2.5">🧪 Інгредієнти / пропорції</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {selectedStage.ingredients.map((ing, idx) => (
                          <div key={idx} className="bg-white border border-gray-200 rounded-xl px-3 py-2">
                            <div className="text-xs text-gray-400">{ing.name}</div>
                            <div className="text-sm font-bold text-gray-800">{ing.amount || '—'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div
                    className="prose-recipe text-sm text-gray-700 border border-gray-100 rounded-2xl px-4 py-3 bg-gray-50/40"
                    style={{ lineHeight: 1.6 }}
                    dangerouslySetInnerHTML={{ __html: selectedStage.content || '<p class="text-gray-400">Опис ще не додано</p>' }}
                  />
                  <div className="text-[11px] text-gray-300 text-right">
                    Оновлено: {new Date(selectedStage.updatedAt).toLocaleString('uk-UA')}
                  </div>
                </div>
              ) : (
                // Перегляд для працівників/перевірки — лише читання
                <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3.5 sm:space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {selectedStage.tempInfo && (
                      <div className="flex items-center gap-2 bg-cyan-50 border border-cyan-100 rounded-xl px-3 py-2">
                        <span className="text-base">🌡️</span>
                        <span className="text-sm text-cyan-700 font-semibold">{selectedStage.tempInfo}</span>
                      </div>
                    )}
                    {selectedStage.timeInfo && (
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                        <span className="text-base">⏱️</span>
                        <span className="text-sm text-amber-700 font-semibold">{selectedStage.timeInfo}</span>
                      </div>
                    )}
                  </div>
                  {selectedStage.isCriticalPoint && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700 flex items-center gap-2">
                      <span className="text-lg">⚠️</span>
                      <span>Контрольна точка HACCP — критичний для безпеки продукції етап. Дотримання параметрів обов'язкове.</span>
                    </div>
                  )}
                  {!!selectedStage.ingredients?.length && (
                    <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/40">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2.5">🧪 Інгредієнти / пропорції</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {selectedStage.ingredients.map((ing, idx) => (
                          <div key={idx} className="bg-white border border-gray-200 rounded-xl px-3 py-2">
                            <div className="text-xs text-gray-400">{ing.name}</div>
                            <div className="text-sm font-bold text-gray-800">{ing.amount || '—'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div
                    className="prose-recipe text-sm text-gray-700 border border-gray-100 rounded-2xl px-4 py-3 bg-gray-50/40"
                    style={{ lineHeight: 1.6 }}
                    dangerouslySetInnerHTML={{ __html: selectedStage.content || '<p class="text-gray-400">Опис ще не додано</p>' }}
                  />
                  <div className="text-[11px] text-gray-300 text-right">
                    Оновлено: {new Date(selectedStage.updatedAt).toLocaleString('uk-UA')}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Модалки */}
      {showSheetModal && (
        <SheetModal sheet={editSheet} onClose={() => { setShowSheetModal(false); setEditSheet(undefined); }} />
      )}

      {confirmDeleteSheet && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-sm w-full">
            <div className="text-2xl text-center mb-2">🗑</div>
            <h3 className="font-bold text-gray-800 text-center mb-1">Видалити "{confirmDeleteSheet.name}"?</h3>
            <p className="text-sm text-gray-500 text-center mb-4">Усі етапи і вміст цього типу сировини будуть видалені незворотно</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteSheet(null)} className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Скасувати</button>
              <button onClick={() => deleteSheetMutation.mutate(confirmDeleteSheet.id)} disabled={deleteSheetMutation.isPending}
                className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                Видалити
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteStage && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-sm w-full">
            <div className="text-2xl text-center mb-2">🗑</div>
            <h3 className="font-bold text-gray-800 text-center mb-1">Видалити етап "{confirmDeleteStage.name}"?</h3>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setConfirmDeleteStage(null)} className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Скасувати</button>
              <button onClick={() => deleteStageMutation.mutate(confirmDeleteStage.id)} disabled={deleteStageMutation.isPending}
                className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                Видалити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
