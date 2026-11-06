import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Project } from './entities/project.entity';
import { ProjectMember } from './entities/project-member.entity';
import { User } from '../users/entities/user.entity';

import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UserRole } from '../users/enums/user-role.enum';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,

    @InjectRepository(ProjectMember)
    private readonly membersRepository: Repository<ProjectMember>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) { }

  async create(
    dto: CreateProjectDto,
    userId: string,
  ): Promise<Project> {
    const project = this.projectsRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      ownerId: userId,
    });

    const savedProject = await this.projectsRepository.save(project);

    const ownerMembership = this.membersRepository.create({
      projectId: savedProject.id,
      userId,
    });

    await this.membersRepository.save(ownerMembership);

    return savedProject;
  }

  async findAll(
    userId: string,
    role: UserRole,
    page = 1,
    limit = 10,
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));

    const query = this.projectsRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.owner', 'owner')
      .orderBy('project.createdAt', 'DESC');

    if (role !== UserRole.ADMIN) {
      query
        .innerJoin(
          'project_members',
          'membership',
          'membership.project_id = project.id',
        )
        .andWhere(
          '(project.owner_id = :userId OR membership.user_id = :userId)',
          { userId },
        );
    }

    const [data, total] = await query
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getManyAndCount();

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async findOne(
    id: string,
    userId: string,
    role: UserRole,
  ): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { id },
      relations: {
        owner: true,
        members: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (role === UserRole.ADMIN) {
      return project;
    }

    const isOwner = project.ownerId === userId;
    const isMember = project.members.some(
      (member) => member.userId === userId,
    );

    if (!isOwner && !isMember) {
      throw new ForbiddenException(
        'You do not have access to this project',
      );
    }

    return project;
  }

  private async checkManagementAccess(
    projectId: string,
    userId: string,
    role: UserRole,
  ): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (
      role !== UserRole.ADMIN &&
      !(role === UserRole.MANAGER && project.ownerId === userId)
    ) {
      throw new ForbiddenException(
        'You cannot manage this project',
      );
    }

    return project;
  }

  async update(
    id: string,
    dto: UpdateProjectDto,
    userId: string,
    role: UserRole,
  ): Promise<Project> {
    const project = await this.checkManagementAccess(
      id,
      userId,
      role,
    );

    Object.assign(project, dto);

    return this.projectsRepository.save(project);
  }

  async remove(
    id: string,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    const project = await this.checkManagementAccess(
      id,
      userId,
      role,
    );

    await this.projectsRepository.remove(project);
  }

  async addMember(
    projectId: string,
    targetUserId: string,
    currentUserId: string,
    role: UserRole,
  ): Promise<ProjectMember> {
    await this.checkManagementAccess(
      projectId,
      currentUserId,
      role,
    );

    const user = await this.usersRepository.findOne({
      where: { id: targetUserId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.isActive) {
      throw new ConflictException(
        'Cannot add an inactive user to a project',
      );
    }

    const existingMembership = await this.membersRepository.findOne({
      where: {
        projectId,
        userId: targetUserId,
      },
    });

    if (existingMembership) {
      throw new ConflictException(
        'User is already a project member',
      );
    }

    const membership = this.membersRepository.create({
      projectId,
      userId: targetUserId,
    });

    const savedMembership = await this.membersRepository.save(membership);

    console.log('SAVED MEMBERSHIP:', savedMembership);

    return savedMembership;

  }

  async removeMember(
    projectId: string,
    targetUserId: string,
    currentUserId: string,
    role: UserRole,
  ): Promise<{ message: string }> {
    const project = await this.checkManagementAccess(
      projectId,
      currentUserId,
      role,
    );

    if (project.ownerId === targetUserId) {
      throw new ForbiddenException(
        'Project owner cannot be removed from the project',
      );
    }

    const result = await this.membersRepository.delete({
      projectId,
      userId: targetUserId,
    });

    if (!result.affected) {
      throw new NotFoundException('Project member not found');
    }

    return {
      message: 'Project member removed successfully',
    };
  }
}