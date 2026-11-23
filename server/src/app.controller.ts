import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

@Controller('api')
export class AppController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Get('health')
  async health() {
    const base = {
      service: 'retailos-server',
      version: process.env.npm_package_version || '0.1.0',
      uptimeSec: Math.round(process.uptime()),
      time: new Date().toISOString(),
    }

    try {
      await this.dataSource.query('SELECT 1')
      return { ...base, ok: true, db: 'up' }
    } catch {
      throw new ServiceUnavailableException({
        ...base,
        ok: false,
        db: 'down',
      })
    }
  }
}
