import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, TaskPriority } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Get()
  findAll(@Request() req, @Query('date') date: string, @Query('userId') userId?: string) {
    return this.tasksService.findAll({
      date,
      userId,
      currentUserId: req.user.id,
      currentRole: req.user.role,
    });
  }

  @Get('board')
  getBoard(@Query('date') date: string) {
    return this.tasksService.getBoard(date);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(
    @Body() dto: {
      title: string; description?: string; date: string; assignedToId: string;
      priority?: TaskPriority; recipeStageIds?: string[];
    },
    @Request() req,
  ) {
    return this.tasksService.create(dto, req.user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: {
      title?: string; description?: string; priority?: TaskPriority; date?: string;
      recipeStageIds?: string[];
    },
    @Request() req,
  ) {
    return this.tasksService.update(id, dto, req.user.id, req.user.role);
  }

  @Patch(':id/toggle')
  toggle(@Param('id') id: string, @Request() req) {
    return this.tasksService.toggle(id, req.user.id, req.user.role);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Request() req) {
    return this.tasksService.delete(id, req.user.id, req.user.role);
  }
}
