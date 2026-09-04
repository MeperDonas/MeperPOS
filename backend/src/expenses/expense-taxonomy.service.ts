import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseGroupDto } from './dto/create-expense-group.dto';
import { UpdateExpenseGroupDto } from './dto/update-expense-group.dto';
import { CreateExpenseLabelDto } from './dto/create-expense-label.dto';
import { UpdateExpenseLabelDto } from './dto/update-expense-label.dto';

@Injectable()
export class ExpenseTaxonomyService {
  constructor(private readonly prisma: PrismaService) {}

  private organization(organizationId?: string): string {
    if (!organizationId) throw new BadRequestException('Organization ID is required for this operation');
    return organizationId;
  }

  async findGroups(organizationId?: string) {
    const orgId = this.organization(organizationId);
    return this.prisma.expenseGroup.findMany({
      where: { organizationId: orgId, active: true },
      orderBy: { name: 'asc' },
      include: { labels: { where: { active: true }, orderBy: { name: 'asc' } } },
    });
  }

  async createGroup(dto: CreateExpenseGroupDto, organizationId?: string) {
    const orgId = this.organization(organizationId);
    const name = dto.name.trim();
    const existing = await this.prisma.expenseGroup.findFirst({ where: { organizationId: orgId, name } });
    if (existing?.active) throw new ConflictException('An expense group with this name already exists');
    if (existing) {
      const result = await this.prisma.expenseGroup.update({ where: { id: existing.id }, data: { name, active: true } });
      await this.audit('EXPENSE_GROUP_REACTIVATED', result.id, orgId);
      return result;
    }
    const result = await this.prisma.expenseGroup.create({ data: { organizationId: orgId, name } });
    await this.audit('EXPENSE_GROUP_CREATED', result.id, orgId);
    return result;
  }

  async updateGroup(id: string, dto: UpdateExpenseGroupDto, organizationId?: string) {
    const orgId = this.organization(organizationId);
    const group = await this.prisma.expenseGroup.findFirst({ where: { id, organizationId: orgId } });
    if (!group) throw new NotFoundException('Expense group not found');
    const name = dto.name?.trim();
    if (name && name !== group.name) {
      const duplicate = await this.prisma.expenseGroup.findFirst({ where: { organizationId: orgId, name } });
      if (duplicate) throw new ConflictException('An expense group with this name already exists');
    }
    const result = await this.prisma.expenseGroup.update({ where: { id }, data: name ? { name } : {} });
    await this.audit('EXPENSE_GROUP_UPDATED', id, orgId);
    return result;
  }

  async removeGroup(id: string, organizationId?: string) {
    const orgId = this.organization(organizationId);
    const group = await this.prisma.expenseGroup.findFirst({ where: { id, organizationId: orgId } });
    if (!group) throw new NotFoundException('Expense group not found');
    const result = await this.prisma.expenseGroup.update({ where: { id }, data: { active: false } });
    await this.audit('EXPENSE_GROUP_DEACTIVATED', id, orgId);
    return result;
  }

  async findLabels(groupId: string, organizationId?: string) {
    const orgId = this.organization(organizationId);
    await this.assertGroup(groupId, orgId);
    return this.prisma.expenseLabel.findMany({ where: { groupId, organizationId: orgId, active: true }, orderBy: { name: 'asc' } });
  }

  async createLabel(dto: CreateExpenseLabelDto, organizationId?: string) {
    const orgId = this.organization(organizationId);
    await this.assertGroup(dto.groupId, orgId);
    const name = dto.name.trim();
    const existing = await this.prisma.expenseLabel.findFirst({ where: { groupId: dto.groupId, name } });
    if (existing?.active) throw new ConflictException('An expense label with this name already exists in the group');
    if (existing) {
      const result = await this.prisma.expenseLabel.update({ where: { id: existing.id }, data: { name, active: true } });
      await this.audit('EXPENSE_LABEL_REACTIVATED', result.id, orgId);
      return result;
    }
    const result = await this.prisma.expenseLabel.create({ data: { organizationId: orgId, groupId: dto.groupId, name } });
    await this.audit('EXPENSE_LABEL_CREATED', result.id, orgId);
    return result;
  }

  async updateLabel(id: string, dto: UpdateExpenseLabelDto, organizationId?: string, groupId?: string) {
    const orgId = this.organization(organizationId);
    const label = await this.prisma.expenseLabel.findFirst({ where: { id, organizationId: orgId } });
    if (!label || (groupId && label.groupId !== groupId)) throw new NotFoundException('Expense label not found');
    const name = dto.name?.trim();
    if (name && name !== label.name) {
      const duplicate = await this.prisma.expenseLabel.findFirst({ where: { groupId: label.groupId, name } });
      if (duplicate) throw new ConflictException('An expense label with this name already exists in the group');
    }
    const result = await this.prisma.expenseLabel.update({ where: { id }, data: name ? { name } : {} });
    await this.audit('EXPENSE_LABEL_UPDATED', id, orgId);
    return result;
  }

  async removeLabel(id: string, organizationId?: string) {
    const orgId = this.organization(organizationId);
    const label = await this.prisma.expenseLabel.findFirst({ where: { id, organizationId: orgId } });
    if (!label) throw new NotFoundException('Expense label not found');
    const result = await this.prisma.expenseLabel.update({ where: { id }, data: { active: false } });
    await this.audit('EXPENSE_LABEL_DEACTIVATED', id, orgId);
    return result;
  }

  private async assertGroup(groupId: string, organizationId: string) {
    const group = await this.prisma.expenseGroup.findFirst({ where: { id: groupId, organizationId, active: true } });
    if (!group) throw new NotFoundException('Expense group not found');
  }

  private audit(action: string, resourceId: string, organizationId: string) {
    return this.prisma.auditLog.create({
      data: { action, resource: 'ExpenseTaxonomy', resourceId, organizationId },
    });
  }
}
