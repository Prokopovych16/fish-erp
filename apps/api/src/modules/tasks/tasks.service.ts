import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { UserRole, TaskPriority } from '@prisma/client';

function dayRange(dateStr: string) {
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { gte: start, lte: end };
}

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  // Підвантажуємо повну інформацію про прикріплені етапи рецептури для списку завдань
  private async enrichWithRecipes<T extends { recipeStageIds: string[] }>(tasks: T[]) {
    const allIds = Array.from(new Set(tasks.flatMap((t) => t.recipeStageIds)));
    if (allIds.length === 0) {
      return tasks.map((t) => ({ ...t, recipeStages: [] }));
    }
    const stages = await this.prisma.recipeStage.findMany({
      where: { id: { in: allIds } },
      include: { recipeSheet: { select: { name: true, icon: true } } },
    });
    const stageMap = new Map(stages.map((s) => [s.id, s]));
    return tasks.map((t) => ({
      ...t,
      recipeStages: t.recipeStageIds.map((id) => stageMap.get(id)).filter(Boolean),
    }));
  }

  async findAll(params: { date: string; userId?: string; currentUserId: string; currentRole: UserRole }) {
    const where: any = { date: dayRange(params.date) };

    if (params.currentRole === UserRole.ADMIN) {
      if (params.userId) where.assignedToId = params.userId;
    } else {
      where.assignedToId = params.currentUserId;
    }

    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: [{ isDone: 'asc' }, { priority: 'desc' }, { createdAt: 'asc' }],
    });
    return this.enrichWithRecipes(tasks);
  }

  async getBoard(date: string) {
    const workers = await this.prisma.user.findMany({
      where: { isActive: true, role: { in: [UserRole.WORKER, UserRole.ADMIN] } },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });

    const tasks = await this.prisma.task.findMany({
      where: { date: dayRange(date) },
      orderBy: [{ isDone: 'asc' }, { priority: 'desc' }, { createdAt: 'asc' }],
    });
    const enriched = await this.enrichWithRecipes(tasks);

    return workers
      .map((w) => ({
        worker: w,
        tasks: enriched.filter((t) => t.assignedToId === w.id),
      }))
      .filter((g) => g.tasks.length > 0);
  }

  async create(dto: {
    title: string;
    description?: string;
    date: string;
    assignedToId: string;
    priority?: TaskPriority;
    recipeStageIds?: string[];
  }, createdById: string) {
    const assignee = await this.prisma.user.findUnique({ where: { id: dto.assignedToId } });
    if (!assignee) throw new HttpException('Працівника не знайдено', HttpStatus.NOT_FOUND);

    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description || null,
        date: new Date(dto.date),
        assignedToId: dto.assignedToId,
        createdById,
        priority: dto.priority || TaskPriority.NORMAL,
        recipeStageIds: dto.recipeStageIds ?? [],
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    const [enriched] = await this.enrichWithRecipes([task]);
    return enriched;
  }

  async update(
    id: string,
    dto: { title?: string; description?: string; priority?: TaskPriority; date?: string; recipeStageIds?: string[] },
    currentUserId: string,
    currentRole: UserRole,
  ) {
    const task = await this.findOneOrFail(id);
    if (currentRole !== UserRole.ADMIN && task.createdById !== currentUserId) {
      throw new HttpException('Недостатньо прав', HttpStatus.FORBIDDEN);
    }
    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description || null }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
        ...(dto.recipeStageIds !== undefined && { recipeStageIds: dto.recipeStageIds }),
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    const [enriched] = await this.enrichWithRecipes([updated]);
    return enriched;
  }

  async toggle(id: string, currentUserId: string, currentRole: UserRole) {
    const task = await this.findOneOrFail(id);
    if (currentRole !== UserRole.ADMIN && task.assignedToId !== currentUserId) {
      throw new HttpException('Це не твоя справа', HttpStatus.FORBIDDEN);
    }
    const updated = await this.prisma.task.update({
      where: { id },
      data: { isDone: !task.isDone, doneAt: !task.isDone ? new Date() : null },
      include: {
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    const [enriched] = await this.enrichWithRecipes([updated]);
    return enriched;
  }

  async delete(id: string, currentUserId: string, currentRole: UserRole) {
    const task = await this.findOneOrFail(id);
    if (currentRole !== UserRole.ADMIN && task.createdById !== currentUserId) {
      throw new HttpException('Недостатньо прав', HttpStatus.FORBIDDEN);
    }
    await this.prisma.task.delete({ where: { id } });
  }

  private async findOneOrFail(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new HttpException('Справу не знайдено', HttpStatus.NOT_FOUND);
    return task;
  }
}
