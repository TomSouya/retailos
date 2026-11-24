import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { AuditService } from '../audit/audit.service'
import { MemberEntity } from '../database/entities/member.entity'
import { SalesOrderEntity } from '../database/entities/sales-order.entity'
import { STORES } from '../domain/data'
import { MEMBER_SEED } from '../domain/profile-data'
import { scopedStores } from '../domain/rbac'
import { ensurePermission, hasPermission } from '../domain/permissions'
import { maskPhone } from '../common/pii'
import { Actor } from '../domain/types'

const LEVELS = ['diamond', 'gold', 'silver', 'basic']
const STATUSES = ['normal', 'dormant']
const POINTS_PER_YUAN = 1
const POINTS_RULE_LABEL = '每消费 1 元积 1 分（按净消费额）'
const DORMANT_DAYS = 45

function daysSince(date: Date | null, now: Date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 0
  return Math.max(
    0,
    Math.floor((now.getTime() - date.getTime()) / 86400000),
  )
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatDateTime(date: Date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parseDateTime(value: string) {
  if (!value) return new Date()
  const iso = value.includes('T') ? value : value.replace(' ', 'T')
  return new Date(iso.length === 16 ? `${iso}:00+08:00` : `${iso}+08:00`)
}

@Injectable()
export class MembersService implements OnModuleInit {
  constructor(
    @InjectRepository(MemberEntity)
    private readonly membersRepository: Repository<MemberEntity>,
    @InjectRepository(SalesOrderEntity)
    private readonly ordersRepository: Repository<SalesOrderEntity>,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    if ((await this.membersRepository.count()) === 0) {
      const now = new Date()
      await this.membersRepository.save(
        MEMBER_SEED.map((member) =>
          this.membersRepository.create({
            ...member,
            joinedAt: parseDateTime(member.joinedAt),
            updatedAt: now,
          }),
        ),
      )
    }
  }

  private scopeIds(actor: Actor) {
    return scopedStores(actor).map((store) => store.id)
  }

  private storeName(storeId: string) {
    return STORES.find((store) => store.id === storeId)?.name || '—'
  }

  private phoneFor(actor: Actor, phone: string) {
    return hasPermission(actor, 'members.pii') ? phone : maskPhone(phone)
  }

  private metricsFrom(orders: SalesOrderEntity[]) {
    const orderCount = orders.length
    const totalSpent = orders.reduce(
      (sum, order) =>
        sum +
        Math.max(
          Number(order.amount) - Number(order.refundedAmount || 0),
          0,
        ),
      0,
    )
    const lastVisit = orders.reduce<Date | null>((latest, order) => {
      const date = order.createdAt
      if (!latest || date > latest) return date
      return latest
    }, null)
    return {
      orderCount,
      totalSpent: Math.round(totalSpent * 100) / 100,
      lastVisitAt: lastVisit ? formatDateTime(lastVisit) : '',
    }
  }

  async list(
    actor: Actor,
    query: {
      search?: string
      level?: string
      status?: string
      storeId?: string
      segment?: string
      inactiveDays?: string | number
    },
  ) {
    ensurePermission(actor, 'members.read', '查看会员')
    const allowed = this.scopeIds(actor)
    if (!allowed.length) {
      return {
        members: [],
        summary: this.emptySummary(),
        pointsRule: POINTS_RULE_LABEL,
        segments: [],
      }
    }

    const rows = await this.membersRepository.find({
      where: { storeId: In(allowed) },
      order: { joinedAt: 'DESC' },
    })
    const orders = await this.ordersRepository.find({
      where: { storeId: In(allowed) },
    })

    const keyword = String(query.search || '').trim().toLowerCase()
    const now = new Date()
    const minInactiveDays = Number(query.inactiveDays)

    const members = rows
      .filter((row) =>
        query.storeId && query.storeId !== 'all'
          ? row.storeId === query.storeId
          : true,
      )
      .filter((row) => (query.level && query.level !== 'all' ? row.level === query.level : true))
      .filter((row) => (query.status && query.status !== 'all' ? row.status === query.status : true))
      .filter((row) => {
        if (!keyword) return true
        return (
          row.name.toLowerCase().includes(keyword) ||
          row.phone.toLowerCase().includes(keyword) ||
          row.id.toLowerCase().includes(keyword)
        )
      })
      .map((row) => {
        const memberOrders = orders.filter(
          (order) => order.memberName === row.name,
        )
        const metrics = this.metricsFrom(memberOrders)
        const lastOrderAt = memberOrders.reduce<Date | null>(
          (latest, order) =>
            !latest || order.createdAt > latest ? order.createdAt : latest,
          null,
        )
        const inactiveDays = daysSince(lastOrderAt || row.joinedAt, now)
        const joinedDays = daysSince(row.joinedAt, now)
        const segments: string[] = []
        if (metrics.orderCount >= 2) segments.push('repeat')
        if (metrics.totalSpent >= 1000) segments.push('high_value')
        if (
          row.status === 'dormant' ||
          (metrics.orderCount > 0 && inactiveDays >= DORMANT_DAYS)
        ) {
          segments.push('dormant')
        }
        if (joinedDays <= 30) segments.push('new')
        if (metrics.orderCount > 0 && inactiveDays <= 15) {
          segments.push('active')
        }

        return {
          id: row.id,
          name: row.name,
          phone: this.phoneFor(actor, row.phone),
          level: row.level,
          storeId: row.storeId,
          storeName: this.storeName(row.storeId),
          points: row.points,
          status: row.status,
          joinedAt: formatDateTime(row.joinedAt),
          updatedAt: formatDateTime(row.updatedAt),
          inactiveDays,
          segments,
          ...metrics,
        }
      })
      .filter((member) =>
        query.segment && query.segment !== 'all'
          ? member.segments.includes(query.segment)
          : true,
      )
      .filter((member) =>
        Number.isFinite(minInactiveDays) && minInactiveDays > 0
          ? member.inactiveDays >= minInactiveDays
          : true,
      )
      .sort((a, b) =>
        String(b.lastVisitAt).localeCompare(String(a.lastVisitAt)),
      )

    return {
      members,
      summary: this.buildSummary(members),
      pointsRule: POINTS_RULE_LABEL,
      segments: [
        { key: 'high_value', label: '高价值' },
        { key: 'repeat', label: '复购' },
        { key: 'active', label: '活跃' },
        { key: 'dormant', label: '沉睡' },
        { key: 'new', label: '新会员' },
      ],
    }
  }

  private emptySummary() {
    return {
      total: 0,
      active: 0,
      dormant: 0,
      silent: 0,
      repeatMembers: 0,
      repeatRate: 0,
      avgSpent: 0,
      totalSpent: 0,
      newThisMonth: 0,
      points: 0,
    }
  }

  private buildSummary(members: any[]) {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const total = members.length
    const repeatMembers = members.filter(
      (item) => Number(item.orderCount) >= 2,
    ).length
    const totalSpent = Math.round(
      members.reduce((sum, item) => sum + Number(item.totalSpent), 0) * 100,
    ) / 100
    return {
      total,
      active: members.filter((item) => item.status === 'normal').length,
      dormant: members.filter((item) => item.status === 'dormant').length,
      silent: members.filter(
        (item) => Number(item.inactiveDays) >= DORMANT_DAYS,
      ).length,
      repeatMembers,
      repeatRate: total
        ? Math.round((repeatMembers / total) * 1000) / 10
        : 0,
      avgSpent: total ? Math.round((totalSpent / total) * 100) / 100 : 0,
      totalSpent,
      newThisMonth: members.filter((item) => {
        const joined = new Date(String(item.joinedAt).replace(' ', 'T'))
        return !Number.isNaN(joined.getTime()) && joined >= monthStart
      }).length,
      points: members.reduce((sum, item) => sum + Number(item.points || 0), 0),
    }
  }

  async detail(actor: Actor, id: string) {
    ensurePermission(actor, 'members.read', '查看会员')
    const allowed = this.scopeIds(actor)
    const member = await this.membersRepository.findOne({ where: { id } })
    if (!member) throw new NotFoundException('会员不存在')
    if (!allowed.includes(member.storeId)) {
      throw new ForbiddenException('当前角色无权查看该会员')
    }

    const memberOrders = await this.ordersRepository.find({
      where: { storeId: In(allowed), memberName: member.name },
      order: { createdAt: 'DESC' },
    })
    const orders = memberOrders.slice(0, 10)
    const metrics = this.metricsFrom(memberOrders)
    const inactiveDays = daysSince(
      memberOrders[0]?.createdAt || member.joinedAt,
      new Date(),
    )
    const segments: string[] = []
    if (metrics.orderCount >= 2) segments.push('repeat')
    if (metrics.totalSpent >= 1000) segments.push('high_value')
    if (
      member.status === 'dormant' ||
      (metrics.orderCount > 0 && inactiveDays >= DORMANT_DAYS)
    ) {
      segments.push('dormant')
    }
    if (daysSince(member.joinedAt, new Date()) <= 30) segments.push('new')
    if (metrics.orderCount > 0 && inactiveDays <= 15) segments.push('active')

    return {
      member: {
        id: member.id,
        name: member.name,
        phone: this.phoneFor(actor, member.phone),
        level: member.level,
        storeId: member.storeId,
        storeName: this.storeName(member.storeId),
        points: member.points,
        status: member.status,
        joinedAt: formatDateTime(member.joinedAt),
        updatedAt: formatDateTime(member.updatedAt),
        inactiveDays,
        segments,
        ...metrics,
      },
      orders: orders.map((order) => ({
        id: order.id,
        storeName: order.storeName,
        itemCount: order.itemCount,
        amount: Number(order.amount),
        refundedAmount: Number(order.refundedAmount || 0),
        status: order.status,
        createdAt: formatDateTime(order.createdAt),
      })),
    }
  }

  async create(
    actor: Actor,
    body: {
      name?: string
      phone?: string
      level?: string
      storeId?: string
      points?: number
    },
  ) {
    ensurePermission(actor, 'members.write', '新增会员')

    const name = String(body.name || '').trim()
    const phone = String(body.phone || '').trim()
    const storeId = String(body.storeId || '').trim()
    const level = String(body.level || 'basic').trim()
    const points =
      body.points === undefined || body.points === null
        ? 0
        : Number(body.points)

    if (!name || !phone || !storeId) {
      throw new BadRequestException('姓名、手机号和所属门店不能为空')
    }
    if (!/^1\d{10}$/.test(phone)) {
      throw new BadRequestException('请输入 11 位手机号')
    }
    if (!LEVELS.includes(level)) {
      throw new BadRequestException('会员等级不合法')
    }
    if (!Number.isInteger(points) || points < 0) {
      throw new BadRequestException('积分必须为非负整数')
    }

    const allowed = this.scopeIds(actor)
    if (!allowed.includes(storeId)) {
      throw new ForbiddenException('当前角色无权在该门店新增会员')
    }

    const rows = await this.membersRepository.find({
      select: { id: true, phone: true },
    })
    if (rows.some((row) => row.phone === phone)) {
      throw new BadRequestException('该手机号已建档')
    }

    const max = rows.reduce((current, row) => {
      const matched = /^MB-(\d+)$/.exec(row.id)
      return matched ? Math.max(current, Number(matched[1])) : current
    }, 0)

    const now = new Date()
    const entity = await this.membersRepository.save(
      this.membersRepository.create({
        id: `MB-${String(max + 1).padStart(4, '0')}`,
        name,
        phone,
        level,
        storeId,
        points,
        joinedAt: now,
        status: 'normal',
        updatedAt: now,
      }),
    )

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: '新增会员',
      object: `${entity.id} ${entity.name}`,
      result: 'success',
      approvalId: '—',
    })

    return {
      id: entity.id,
      name: entity.name,
      phone: this.phoneFor(actor, entity.phone),
      level: entity.level,
      storeId: entity.storeId,
      storeName: this.storeName(entity.storeId),
      points: entity.points,
      status: entity.status,
      joinedAt: formatDateTime(entity.joinedAt),
      updatedAt: formatDateTime(entity.updatedAt),
      orderCount: 0,
      totalSpent: 0,
      lastVisitAt: '',
    }
  }

  async recalculatePoints(actor: Actor) {
    ensurePermission(actor, 'members.write', '重算会员积分')
    const allowed = this.scopeIds(actor)
    if (!allowed.length) {
      return { updated: 0, totalPoints: 0, rule: POINTS_RULE_LABEL }
    }

    const [rows, orders] = await Promise.all([
      this.membersRepository.find({ where: { storeId: In(allowed) } }),
      this.ordersRepository.find({ where: { storeId: In(allowed) } }),
    ])

    const netByMember = new Map<string, number>()
    for (const order of orders) {
      const name = String(order.memberName || '').trim()
      if (!name || name === '到店顾客') continue
      const net = Math.max(
        Number(order.amount) - Number(order.refundedAmount || 0),
        0,
      )
      netByMember.set(name, (netByMember.get(name) || 0) + net)
    }

    const now = new Date()
    let updated = 0
    let totalPoints = 0
    for (const row of rows) {
      const points = Math.floor(
        (netByMember.get(row.name) || 0) * POINTS_PER_YUAN,
      )
      totalPoints += points
      if (points !== Number(row.points)) {
        row.points = points
        row.updatedAt = now
        await this.membersRepository.save(row)
        updated += 1
      }
    }

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: '按消费重算积分',
      object: `${updated} 位会员`,
      result: 'success',
      approvalId: '—',
    })

    return { updated, totalPoints, rule: POINTS_RULE_LABEL }
  }

  async update(
    actor: Actor,
    id: string,
    body: { level?: string; status?: string; points?: number },
  ) {
    ensurePermission(actor, 'members.write', '编辑会员')
    const allowed = this.scopeIds(actor)
    const entity = await this.membersRepository.findOne({ where: { id } })
    if (!entity) throw new NotFoundException('会员不存在')
    if (!allowed.includes(entity.storeId)) {
      throw new ForbiddenException('当前角色无权编辑该会员')
    }

    if (body.level !== undefined) {
      if (!LEVELS.includes(body.level)) {
        throw new BadRequestException('会员等级不合法')
      }
      entity.level = body.level
    }
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) {
        throw new BadRequestException('会员状态不合法')
      }
      entity.status = body.status
    }
    if (body.points !== undefined) {
      const points = Number(body.points)
      if (!Number.isFinite(points) || points < 0) {
        throw new BadRequestException('积分不合法')
      }
      entity.points = Math.round(points)
    }
    entity.updatedAt = new Date()
    const saved = await this.membersRepository.save(entity)

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: '编辑会员',
      object: saved.id,
      result: 'success',
      approvalId: '—',
    })

    const result = await this.detail(actor, id)
    return result.member
  }
}
