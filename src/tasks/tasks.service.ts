import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Task } from './entities/task.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectMember } from '../projects/entities/project-member.entity';
import { User } from '../users/entities/user.entity';

import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';

import { UserRole } from '../users/enums/user-role.enum';
import { TaskStatus } from './enums/task-status.enum';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,

    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,

    @InjectRepository(ProjectMember)
    private readonly membersRepository: Repository<ProjectMember>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  private async getProject(projectId: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  private async isProjectMember(
    projectId: string,
    userId: string,
  ): Promise<boolean> {
    const membership = await this.membersRepository.findOne({
      where: { projectId, userId },
    });

    return !!membership;
  }

  private async checkProjectViewAccess(
    project: Project,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    if (role === UserRole.ADMIN) return;

    const isMember = await this.isProjectMember(project.id, userId);

    if (!isMember) {
      throw new ForbiddenException(
        'You do not have access to this project',
      );
    }
  }

  private async checkProjectManagementAccess(
    project: Project,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    if (role === UserRole.ADMIN) return;

    if (
      role === UserRole.MANAGER &&
      project.ownerId === userId
    ) {
      return;
    }

    throw new ForbiddenException(
      'You cannot manage tasks in this project',
    );
  }

  private async validateAssignee(
    projectId: string,
    assigneeId?: string | null,
  ): Promise<void> {
    if (!assigneeId) return;

    const user = await this.usersRepository.findOne({
      where: { id: assigneeId },
    });

    if (!user) {
      throw new NotFoundException('Assignee not found');
    }

    if (!user.isActive) {
      throw new BadRequestException(
        'Cannot assign a task to an inactive user',
      );
    }

    const isMember = await this.isProjectMember(
      projectId,
      assigneeId,
    );

    if (!isMember) {
      throw new BadRequestException(
        'Assignee must be a member of the project',
      );
    }
  }

  async create(
    projectId: string,
    dto: CreateTaskDto,
    currentUserId: string,
    role: UserRole,
  ): Promise<Task> {
    const project = await this.getProject(projectId);

    await this.checkProjectManagementAccess(
      project,
      currentUserId,
      role,
    );

    await this.validateAssignee(projectId, dto.assigneeId);

    const task = this.tasksRepository.create({
      ...dto,
      projectId,
      createdBy: currentUserId,
      status: TaskStatus.TODO,
    });

    return this.tasksRepository.save(task);
  }

  async findAll(
    projectId: string,
    currentUserId: string,
    role: UserRole,
    page = 1,
    limit = 10,
  ) {
    const project = await this.getProject(projectId);

    await this.checkProjectViewAccess(
      project,
      currentUserId,
      role,
    );

    const [data, total] = await this.tasksRepository.findAndCount({
      where: { projectId },
      relations: {
        assignee: true,
        creator: true,
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(
    taskId: string,
    currentUserId: string,
    role: UserRole,
  ): Promise<Task> {
    const task = await this.tasksRepository.findOne({
      where: { id: taskId },
      relations: {
        project: true,
        assignee: true,
        creator: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.checkProjectViewAccess(
      task.project,
      currentUserId,
      role,
    );

    return task;
  }

  async update(
    taskId: string,
    dto: UpdateTaskDto,
    currentUserId: string,
    role: UserRole,
  ): Promise<Task> {
    const task = await this.findOne(
      taskId,
      currentUserId,
      role,
    );

    await this.checkProjectManagementAccess(
      task.project,
      currentUserId,
      role,
    );

    if (dto.assigneeId !== undefined) {
      await this.validateAssignee(
        task.projectId,
        dto.assigneeId,
      );
    }

    Object.assign(task, dto);

    return this.tasksRepository.save(task);
  }

  async updateStatus(
    taskId: string,
    dto: UpdateTaskStatusDto,
    currentUserId: string,
    role: UserRole,
  ): Promise<Task> {
    const task = await this.findOne(
      taskId,
      currentUserId,
      role,
    );

    if (role === UserRole.ADMIN) {
      task.status = dto.status;
      return this.tasksRepository.save(task);
    }

    if (
      role === UserRole.MANAGER &&
      task.project.ownerId === currentUserId
    ) {
      task.status = dto.status;
      return this.tasksRepository.save(task);
    }

    if (
      role === UserRole.MEMBER &&
      task.assigneeId === currentUserId
    ) {
      task.status = dto.status;
      return this.tasksRepository.save(task);
    }

    throw new ForbiddenException(
      'You cannot update this task status',
    );
  }

  async remove(
    taskId: string,
    currentUserId: string,
    role: UserRole,
  ): Promise<{ message: string }> {
    const task = await this.findOne(
      taskId,
      currentUserId,
      role,
    );

    await this.checkProjectManagementAccess(
      task.project,
      currentUserId,
      role,
    );

    await this.tasksRepository.remove(task);

    return {
      message: 'Task deleted successfully',
    };
  }
}