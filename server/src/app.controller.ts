import {
  Controller,
  Get,
  Header,
  Headers,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { renderMetrics } from './common/metrics'

@Controller('api')
export class AppController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private baseInfo() {
    return {
      service: 'retailos-server',
      version: process.env.npm_package_version || '0.1.0',
      uptimeSec: Math.round(process.uptime()),
      time: new Date().toISOString(),
    }
  }

  private async databaseUp() {
    try {
      await this.dataSource.query('SELECT 1')
      return true
    } catch {
      return false
    }
  }

  @Get('health')
  async health() {
    const base = this.baseInfo()
    if (await this.databaseUp()) {
      return { ...base, ok: true, db: 'up' }
    }
    throw new ServiceUnavailableException({
      ...base,
      ok: false,
      db: 'down',
    })
  }

  // 进程存活探针：不依赖数据库，用于容器/负载均衡重启判断
  @Get('health/live')
  live() {
    return { ...this.baseInfo(), ok: true }
  }

  // 就绪探针：数据库不可用时返回 503，摘除流量
  @Get('health/ready')
  async ready() {
    const base = this.baseInfo()
    if (await this.databaseUp()) {
      return { ...base, ok: true, db: 'up' }
    }
    throw new ServiceUnavailableException({
      ...base,
      ok: false,
      db: 'down',
    })
  }

  // Prometheus 文本指标；可用 METRICS_TOKEN 限制访问
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(@Headers('authorization') authorization?: string) {
    const token = process.env.METRICS_TOKEN
    if (token && authorization !== `Bearer ${token}`) {
      throw new UnauthorizedException('指标接口需要令牌')
    }
    return renderMetrics(await this.databaseUp())
  }
}
