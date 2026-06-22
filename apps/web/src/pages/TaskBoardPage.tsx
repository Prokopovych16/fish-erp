import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/axios';

type Priority = 'LOW' | 'NORMAL' | 'HIGH';

interface RecipeStageRef {
  id: string;
  name: string;
  tempInfo?: string | null;
  timeInfo?: string | null;
  isCriticalPoint?: boolean;
  recipeSheet: { name: string; icon: string | null };
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  isDone: boolean;
  recipeStages?: RecipeStageRef[];
}

interface BoardGroup {
  worker: { id: string; name: string };
  tasks: Task[];
}

const PRIORITY_CFG: Record<Priority, { label: string; cls: string }> = {
  HIGH: { label: '🔴 Важливо', cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
  NORMAL: { label: '🔵 Звичайне', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  LOW: { label: '⚪ Не термінове', cls: 'bg-white/10 text-slate-400 border-white/10' },
};

const AVATAR_COLORS = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500', 'bg-indigo-500'];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function TaskBoardPage() {
  const [date] = useState(todayStr());
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: groups = [] } = useQuery<BoardGroup[]>({
    queryKey: ['tasks-board', date],
    queryFn: () => api.get('/tasks/board', { params: { date } }).then(r => r.data),
    refetchInterval: 15000,
  });

  const totalTasks = groups.reduce((s, g) => s + g.tasks.length, 0);
  const totalDone = groups.reduce((s, g) => s + g.tasks.filter(t => t.isDone).length, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-8">
      {/* Шапка */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-4xl shadow-lg shadow-emerald-500/30">✅</div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Справи на сьогодні</h1>
            <p className="text-slate-400 text-lg mt-0.5">
              {now.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-5xl font-bold tabular-nums tracking-tight">{now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</div>
          {totalTasks > 0 && (
            <div className="flex items-center gap-2 justify-end mt-1.5">
              <div className="w-32 h-2.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all" style={{ width: `${(totalDone / totalTasks) * 100}%` }} />
              </div>
              <span className="text-slate-300 font-semibold text-lg">{totalDone}/{totalTasks}</span>
            </div>
          )}
        </div>
      </div>

      {/* Картки працівників */}
      {groups.length === 0 ? (
        <div className="text-center py-32">
          <div className="text-7xl mb-4 opacity-30">🌴</div>
          <p className="text-3xl font-bold text-slate-400">На сьогодні справ немає</p>
        </div>
      ) : (
        <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${Math.min(groups.length, 4)}, minmax(0, 1fr))` }}>
          {groups.map((g, idx) => {
            const done = g.tasks.filter(t => t.isDone).length;
            const allDone = done === g.tasks.length && g.tasks.length > 0;
            return (
              <div key={g.worker.id} className={`rounded-3xl border p-5 flex flex-col ${allDone ? 'bg-emerald-950/40 border-emerald-500/30' : 'bg-white/5 border-white/10'} backdrop-blur-sm`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-2xl ${AVATAR_COLORS[idx % AVATAR_COLORS.length]} flex items-center justify-center text-xl font-bold shadow-lg`}>
                    {g.worker.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xl truncate">{g.worker.name}</div>
                    <div className="text-slate-400 text-sm font-medium">{done}/{g.tasks.length} виконано</div>
                  </div>
                  {allDone && <span className="text-3xl">🎉</span>}
                </div>

                <div className="space-y-2.5 flex-1">
                  {g.tasks.map(task => (
                    <div key={task.id} className={`flex items-start gap-3 p-3 rounded-2xl transition-all ${task.isDone ? 'bg-white/5' : 'bg-white/10'}`}>
                      <div className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mt-0.5 ${task.isDone ? 'bg-emerald-400 border-emerald-400' : 'border-white/30'}`}>
                        {task.isDone && <span className="text-slate-900 text-xs font-bold">✓</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`font-semibold text-base leading-snug ${task.isDone ? 'text-slate-500 line-through' : 'text-white'}`}>{task.title}</div>
                        {task.description && (
                          <div className={`text-sm mt-0.5 ${task.isDone ? 'text-slate-600' : 'text-slate-400'}`}>📝 {task.description}</div>
                        )}
                        <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-semibold border mt-1.5 ${PRIORITY_CFG[task.priority].cls}`}>
                          {PRIORITY_CFG[task.priority].label}
                        </span>
                        {!!task.recipeStages?.length && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-2">
                            {task.recipeStages.map(s => (
                              <span key={s.id} className="flex items-center gap-1 text-[11px] bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 px-2 py-0.5 rounded-full font-medium">
                                📖 {s.recipeSheet.icon || '🐟'} {s.name}
                                {s.tempInfo && <span className="text-cyan-200">· 🌡️{s.tempInfo}</span>}
                                {s.timeInfo && <span className="text-cyan-200">· ⏱️{s.timeInfo}</span>}
                                {s.isCriticalPoint && <span title="Контрольна точка HACCP">⚠️</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
