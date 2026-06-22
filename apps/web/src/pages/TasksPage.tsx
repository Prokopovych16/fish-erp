import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/api/axios';
import { useAuthStore } from '@/store/auth';

type Priority = 'LOW' | 'NORMAL' | 'HIGH';

interface RecipeStageRef {
  id: string;
  name: string;
  content?: string | null;
  tempInfo?: string | null;
  timeInfo?: string | null;
  isCriticalPoint?: boolean;
  ingredients?: { name: string; amount: string }[] | null;
  recipeSheet: { name: string; icon: string | null };
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  date: string;
  priority: Priority;
  isDone: boolean;
  doneAt: string | null;
  assignedTo: { id: string; name: string };
  createdBy: { id: string; name: string };
  recipeStageIds: string[];
  recipeStages?: RecipeStageRef[];
}

const PRIORITY_CFG: Record<Priority, { label: string; cls: string; dot: string }> = {
  HIGH: { label: 'Високий', cls: 'bg-red-50 text-red-600 border-red-200', dot: 'bg-red-500' },
  NORMAL: { label: 'Звичайний', cls: 'bg-blue-50 text-blue-600 border-blue-200', dot: 'bg-blue-500' },
  LOW: { label: 'Низький', cls: 'bg-gray-50 text-gray-500 border-gray-200', dot: 'bg-gray-400' },
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Пікер прикріплення етапів з Рецептури ───────────────────────────────────
function RecipePicker({ selected, onChange }: {
  selected: RecipeStageRef[];
  onChange: (stages: RecipeStageRef[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [browseSheetId, setBrowseSheetId] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sheets = [] } = useQuery<any[]>({
    queryKey: ['recipe-sheets'],
    queryFn: () => api.get('/recipes').then(r => r.data),
    enabled: open,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: browseSheet } = useQuery<any>({
    queryKey: ['recipe-sheet', browseSheetId],
    queryFn: () => api.get(`/recipes/${browseSheetId}`).then(r => r.data),
    enabled: !!browseSheetId,
  });

  const isSelected = (id: string) => selected.some(s => s.id === id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toggleStage = (stage: any, sheet: any) => {
    if (isSelected(stage.id)) {
      onChange(selected.filter(s => s.id !== stage.id));
    } else {
      onChange([...selected, {
        id: stage.id, name: stage.name, content: stage.content,
        tempInfo: stage.tempInfo, timeInfo: stage.timeInfo,
        isCriticalPoint: stage.isCriticalPoint, ingredients: stage.ingredients,
        recipeSheet: { name: sheet.name, icon: sheet.icon },
      }]);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">📖 З бази знань</label>
        <button type="button" onClick={() => setOpen(v => !v)}
          className="text-xs text-blue-600 hover:text-blue-700 font-semibold">
          {open ? 'Згорнути' : '+ Прикріпити'}
        </button>
      </div>

      {/* Вибрані чіпи */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map(s => (
            <span key={s.id} className="flex items-center gap-1 text-xs bg-cyan-50 border border-cyan-200 text-cyan-700 pl-2 pr-1 py-1 rounded-full font-medium">
              {s.recipeSheet.icon || '🐟'} {s.recipeSheet.name} · {s.name}
              {s.isCriticalPoint && <span title="Контрольна точка HACCP">⚠️</span>}
              <button type="button" onClick={() => onChange(selected.filter(x => x.id !== s.id))}
                className="text-cyan-400 hover:text-red-500 ml-0.5 leading-none px-1">×</button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="border border-gray-200 rounded-xl bg-gray-50/60 p-2.5 space-y-2">
          {!browseSheetId ? (
            sheets.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-3">У Рецептурі ще немає записів</div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {sheets.map((sheet: any) => (
                  <button key={sheet.id} type="button" onClick={() => setBrowseSheetId(sheet.id)}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white border border-gray-200 hover:border-cyan-300 hover:bg-cyan-50/50 transition-colors text-left">
                    <span className="text-base shrink-0">{sheet.icon || '🐟'}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-700 truncate">{sheet.name}</div>
                      <div className="text-[10px] text-gray-400">{sheet._count?.stages ?? 0} етапів</div>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div>
              <button type="button" onClick={() => setBrowseSheetId(null)}
                className="text-xs text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1">
                ← Усі типи сировини
              </button>
              {!browseSheet ? (
                <div className="text-xs text-gray-400 text-center py-3">Завантаження...</div>
              ) : browseSheet.stages.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-3">У цього типу сировини ще немає етапів</div>
              ) : (
                <div className="space-y-1">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {browseSheet.stages.map((stage: any) => (
                    <label key={stage.id}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${isSelected(stage.id) ? 'bg-cyan-50 border border-cyan-200' : 'bg-white border border-gray-100 hover:border-gray-200'}`}>
                      <input type="checkbox" checked={isSelected(stage.id)}
                        onChange={() => toggleStage(stage, browseSheet)}
                        className="accent-cyan-600 w-4 h-4 shrink-0" />
                      <span className="text-sm text-gray-700 flex-1">{stage.name}</span>
                      {stage.isCriticalPoint && <span className="text-xs" title="Контрольна точка HACCP">⚠️</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskModal({ workers, defaultUserId, date, editTask, onClose }: {
  workers: { id: string; name: string }[];
  defaultUserId?: string;
  date: string;
  editTask?: Task;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editTask;
  const [title, setTitle] = useState(editTask?.title || '');
  const [description, setDescription] = useState(editTask?.description || '');
  const [assignedToId, setAssignedToId] = useState(editTask?.assignedTo.id || defaultUserId || workers[0]?.id || '');
  const [priority, setPriority] = useState<Priority>(editTask?.priority || 'NORMAL');
  const [taskDate, setTaskDate] = useState(editTask?.date.slice(0, 10) || date);
  const [recipeStages, setRecipeStages] = useState<RecipeStageRef[]>(editTask?.recipeStages || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!title.trim()) return setError('Вкажіть назву справи');
    if (!isEdit && !assignedToId) return setError('Оберіть працівника');
    setLoading(true); setError('');
    const recipeStageIds = recipeStages.map(s => s.id);
    try {
      if (isEdit) {
        await api.patch(`/tasks/${editTask.id}`, { title, description: description || '', priority, date: taskDate, recipeStageIds });
      } else {
        await api.post('/tasks', { title, description: description || undefined, date: taskDate, assignedToId, priority, recipeStageIds });
      }
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Помилка збереження');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
          <h2 className="font-bold text-gray-800">{isEdit ? '✏️ Редагувати справу' : '➕ Нова справа'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Назва *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Прибрати склад..."
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Примітка</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Необов'язково..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Працівник</label>
              <select value={assignedToId} onChange={e => setAssignedToId(e.target.value)} disabled={isEdit}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400">
                {isEdit
                  ? <option value={editTask.assignedTo.id}>{editTask.assignedTo.name}</option>
                  : workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Дата</label>
              <input type="date" value={taskDate} onChange={e => setTaskDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Важливість</label>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
              {(['LOW', 'NORMAL', 'HIGH'] as Priority[]).map(p => (
                <button key={p} onClick={() => setPriority(p)}
                  className={`flex-1 py-2 font-medium transition-colors ${priority === p ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                  {PRIORITY_CFG[p].label}
                </button>
              ))}
            </div>
          </div>

          <RecipePicker selected={recipeStages} onChange={setRecipeStages} />

          {error && <div className="text-red-500 text-sm bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">⚠️ {error}</div>}
        </div>
        <div className="px-5 pb-5 pt-2 flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50">Скасувати</button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 bg-blue-600 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-bold">
            {loading ? 'Зберігаю...' : isEdit ? 'Зберегти' : 'Створити'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Перегляд прикріпленого етапу рецептури ──────────────────────────────────
function RecipeStagePreviewModal({ stage, onClose }: { stage: RecipeStageRef; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-white">{stage.recipeSheet.icon || '🐟'} {stage.recipeSheet.name}</h2>
            <p className="text-cyan-100 text-xs mt-0.5">{stage.name}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none shrink-0">×</button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="flex flex-wrap items-center gap-3">
            {stage.tempInfo && (
              <div className="flex items-center gap-2 bg-cyan-50 border border-cyan-100 rounded-xl px-3 py-2">
                <span className="text-base">🌡️</span>
                <span className="text-sm text-cyan-700 font-semibold">{stage.tempInfo}</span>
              </div>
            )}
            {stage.timeInfo && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                <span className="text-base">⏱️</span>
                <span className="text-sm text-amber-700 font-semibold">{stage.timeInfo}</span>
              </div>
            )}
          </div>
          {stage.isCriticalPoint && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700 flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <span>Контрольна точка HACCP — дотримання параметрів обов'язкове.</span>
            </div>
          )}
          {!!stage.ingredients?.length && (
            <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/40">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2.5">🧪 Інгредієнти / пропорції</div>
              <div className="grid grid-cols-2 gap-2">
                {stage.ingredients.map((ing, idx) => (
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
            dangerouslySetInnerHTML={{ __html: stage.content || '<p class="text-gray-400">Опис відсутній</p>' }}
          />
        </div>
        <div className="px-5 py-4 border-t shrink-0">
          <button onClick={onClose} className="w-full border border-gray-200 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50">Закрити</button>
        </div>
      </div>
    </div>
  );
}

function TaskRow({ task, canManage, onToggle, onEdit, onDelete }: {
  task: Task; canManage: boolean; onToggle: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const cfg = PRIORITY_CFG[task.priority];
  const [previewStage, setPreviewStage] = useState<RecipeStageRef | null>(null);
  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all group ${task.isDone ? 'bg-gray-50/60 border-gray-100' : 'bg-white border-gray-200 hover:shadow-sm'}`}>
      <button onClick={onToggle}
        className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mt-0.5 transition-all ${task.isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 hover:border-emerald-400'}`}>
        {task.isDone && '✓'}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-sm ${task.isDone ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{task.title}</div>
        {task.description && <div className={`text-xs mt-0.5 ${task.isDone ? 'text-gray-300' : 'text-gray-500'}`}>📝 {task.description}</div>}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${cfg.cls}`}>{cfg.label}</span>
          {task.isDone && task.doneAt && <span className="text-[10px] text-gray-400">виконано {new Date(task.doneAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
        {!!task.recipeStages?.length && (
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            {task.recipeStages.map(s => (
              <button key={s.id} onClick={() => setPreviewStage(s)}
                className="flex items-center gap-1 text-[11px] bg-cyan-50 border border-cyan-200 text-cyan-700 px-2 py-0.5 rounded-full font-medium hover:bg-cyan-100 transition-colors">
                {s.recipeSheet.icon || '🐟'} {s.name}
                {s.isCriticalPoint && <span title="Контрольна точка HACCP">⚠️</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {canManage && (
        <div className="opacity-0 group-hover:opacity-100 transition-all flex items-center gap-0.5 shrink-0">
          <button onClick={onEdit} className="text-gray-300 hover:text-blue-500 text-sm leading-none w-6 h-6 rounded-lg hover:bg-blue-50 flex items-center justify-center">✏️</button>
          <button onClick={onDelete} className="text-gray-300 hover:text-red-500 text-lg leading-none w-6 h-6 rounded-lg hover:bg-red-50 flex items-center justify-center">×</button>
        </div>
      )}
      {previewStage && <RecipeStagePreviewModal stage={previewStage} onClose={() => setPreviewStage(null)} />}
    </div>
  );
}

export default function TasksPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayStr());
  const [showAdd, setShowAdd] = useState(false);
  const [addForUserId, setAddForUserId] = useState<string | undefined>(undefined);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const { data: workers = [] } = useQuery({
    queryKey: ['users-active'],
    queryFn: () => api.get('/users').then(r => r.data),
    enabled: isAdmin,
  });

  const activeWorkers = (workers as any[]).filter(w => w.isActive);

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', date],
    queryFn: () => api.get('/tasks', { params: { date } }).then(r => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/tasks/${id}/toggle`).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const isToday = date === todayStr();
  const shiftDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  };

  // Групуємо по працівнику (тільки для адміна)
  const grouped = isAdmin
    ? activeWorkers.map(w => ({ worker: w, tasks: tasks.filter(t => t.assignedTo.id === w.id) }))
    : [{ worker: user, tasks }];

  const totalDone = tasks.filter(t => t.isDone).length;

  return (
    <div className="space-y-5">
      {/* Шапка */}
      <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50/40 rounded-2xl sm:rounded-3xl border border-gray-100 p-3.5 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xl shadow-md shadow-emerald-200">✅</div>
            <div>
              <h1 className="text-xl font-bold text-gray-800 tracking-tight">Справи на день</h1>
              <p className="text-sm text-gray-400">{tasks.length > 0 ? `${totalDone}/${tasks.length} виконано` : 'Список завдань'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/board/tasks" target="_blank"
              className="bg-white border border-gray-200 text-gray-600 text-sm px-3.5 py-2 rounded-xl hover:bg-gray-50 transition-all font-medium flex items-center gap-1.5 shadow-sm">
              📺 Борд для ТВ
            </Link>
            {isAdmin && (
              <button onClick={() => { setAddForUserId(undefined); setShowAdd(true); }}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm px-4 py-2 rounded-xl hover:opacity-90 transition-all font-semibold flex items-center gap-1.5 shadow-md shadow-blue-200">
                + Нова справа
              </button>
            )}
          </div>
        </div>

        {/* Дата-навігація */}
        <div className="flex items-center gap-2 mt-4">
          <button onClick={() => shiftDate(-1)} className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center">←</button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white" />
          <button onClick={() => shiftDate(1)} className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center">→</button>
          {!isToday && (
            <button onClick={() => setDate(todayStr())} className="text-sm text-blue-600 hover:underline font-medium ml-1">Сьогодні</button>
          )}
        </div>
      </div>

      {/* Контент */}
      {isLoading ? (
        <div className="text-center text-gray-400 py-16">Завантаження...</div>
      ) : grouped.every(g => g.tasks.length === 0) ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
          <div className="text-5xl mb-3 opacity-40">🗒️</div>
          <p className="font-semibold text-gray-500">Немає справ на цю дату</p>
          {isAdmin && <p className="text-sm text-gray-400 mt-1">Натисни «+ Нова справа» щоб додати</p>}
        </div>
      ) : (
        <div className={`grid gap-4 ${isAdmin ? 'sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 max-w-2xl'}`}>
          {grouped.filter(g => g.tasks.length > 0 || isAdmin).map(({ worker, tasks: wTasks }) => {
            if (!worker) return null;
            const done = wTasks.filter(t => t.isDone).length;
            return (
              <div key={worker.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {worker.name?.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-gray-800 text-sm truncate">{worker.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {wTasks.length > 0 && <span className="text-xs text-gray-400 font-medium">{done}/{wTasks.length}</span>}
                    {isAdmin && (
                      <button onClick={() => { setAddForUserId(worker.id); setShowAdd(true); }}
                        className="text-blue-500 hover:text-blue-700 text-sm font-bold w-6 h-6 rounded-lg hover:bg-blue-50 flex items-center justify-center">+</button>
                    )}
                  </div>
                </div>
                <div className="p-3 space-y-2 flex-1">
                  {wTasks.length === 0 ? (
                    <div className="text-center text-gray-300 text-xs py-6">Немає справ</div>
                  ) : (
                    wTasks.map(task => (
                      <TaskRow key={task.id} task={task}
                        canManage={isAdmin}
                        onToggle={() => toggleMutation.mutate(task.id)}
                        onEdit={() => setEditingTask(task)}
                        onDelete={() => deleteMutation.mutate(task.id)} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <TaskModal workers={isAdmin ? activeWorkers : []} defaultUserId={addForUserId} date={date} onClose={() => setShowAdd(false)} />
      )}
      {editingTask && (
        <TaskModal workers={isAdmin ? activeWorkers : []} date={date} editTask={editingTask} onClose={() => setEditingTask(null)} />
      )}
    </div>
  );
}
