import 'reflect-metadata'
import { config } from 'dotenv'
import { DataSource } from 'typeorm'
import { ENTITIES } from './entities'
import { MIGRATIONS } from './migrations'

config()

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USER || 'retailos',
  password: process.env.DB_PASSWORD || 'retailos_dev',
  database: process.env.DB_NAME || 'retailos',
  charset: 'utf8mb4',
  timezone: '+08:00',
  entities: ENTITIES,
  migrations: MIGRATIONS,
  synchronize: false,
  logging: false,
})
