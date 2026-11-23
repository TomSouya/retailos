import {
  ForbiddenException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { INITIAL_AUDIT } from '../domain/data'
import { ensurePermission } from '../domain/permissions'
import { Actor, AuditRecord } from '../domain/types'
import { AuditRecordEntity } from '../database/entities/audit-record.entity'
import { currentTraceId } from '../common/request-context'

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatDateTime(date: Date, withSeconds = true) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  const base = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  return withSeconds ? `${base}:${pad(date.getSeconds())}` : base
}

function formatDate(date = new Date()) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

function parseDateTime(value: string) {
  if (!value) return new Date()
  const iso = value.includes('T') ? value : value.replace(' ', 'T')
  return new Date(iso.length === 16 ? `${iso}:00+08:00` : `${iso}+08:00`)
}

function toAuditDto(entity: AuditRecordEntity): AuditRecord {
  return {
    id: entity.id,
    timestamp: formatDateTime(entity.timestamp),
    actor: entity.actor,
    role: entity.role,
    action: entity.action,
    object: entity.object,
    result: entity.result,
    approvalId: entity.approvalId,
    traceId: entity.traceId || '',
  }
}

@Injectable()
export class AuditService implements OnModuleInit {
  constructor(
    @InjectRepository(AuditRecordEntity)
    private readonly auditRepository: Repository<AuditRecordEntity>,
  ) {}

  async onModuleInit() {
    const count = await this.auditRepository.count()
    if (count > 0) return
    for (const seed of INITIAL_AUDIT) {
      await this.auditRepository.save(
        this.auditRepository.create({
          ...seed,
          timestamp: parseDateTime(seed.timestamp),
        }),
      )
    }
  }

  async record(entry: Omit<AuditRecord, 'id' | 'timestamp' | 'traceId'>) {
    await this.auditRepository.save(
      this.auditRepository.create({
        id: `AU-${formatDate()}-${String(Date.now()).slice(-6)}`,
        timestamp: new Date(),
        traceId: currentTraceId() || null,
        ...entry,
      }),
    )
  }

  async list(actor: Actor): Promise<AuditRecord[]> {
    ensurePermission(actor, 'system.audit', '查看审计日志')
    const rows = await this.auditRepository.find({
      order: { timestamp: 'DESC' },
    })
    return rows.map(toAuditDto)
  }
}
