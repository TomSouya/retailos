import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Like, Repository } from 'typeorm'
import { MemberEntity } from '../database/entities/member.entity'
import { ProductEntity } from '../database/entities/product.entity'
import { SalesOrderEntity } from '../database/entities/sales-order.entity'
import { SalesOrderItemEntity } from '../database/entities/sales-order-item.entity'
import { StoreEntity } from '../database/entities/store.entity'

const DEMO_PREFIX = 'SO-DEMO-'
const DAYS = 60
const PAYMENT_METHODS = ['wechat', 'alipay', 'card', 'cash']

function mulberry32(seed: number) {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
  )
}

function dayKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

/**
 * 为演示环境补充近 60 天订单：30 天用于展示，前 30 天作为环比基准。
 * 已存在 SO-DEMO- 前缀订单时直接跳过，重启不会重复写入。
 * 使用 OnApplicationBootstrap，确保商品、门店等基础种子已就绪。
 */
@Injectable()
export class DemoOrdersSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(DemoOrdersSeeder.name)

  constructor(
    @InjectRepository(SalesOrderEntity)
    private readonly ordersRepository: Repository<SalesOrderEntity>,
    @InjectRepository(SalesOrderItemEntity)
    private readonly itemsRepository: Repository<SalesOrderItemEntity>,
    @InjectRepository(ProductEntity)
    private readonly productsRepository: Repository<ProductEntity>,
    @InjectRepository(StoreEntity)
    private readonly storesRepository: Repository<StoreEntity>,
    @InjectRepository(MemberEntity)
    private readonly membersRepository: Repository<MemberEntity>,
  ) {}

  async onApplicationBootstrap() {
    const [products, stores] = await Promise.all([
      this.productsRepository.find({
        where: { status: 'active' },
        order: { id: 'ASC' },
        take: 10,
      }),
      this.storesRepository.find({ order: { id: 'ASC' } }),
    ])

    if (!products.length || !stores.length) return

    const seeded = await this.ordersRepository.count({
      where: { id: Like(`${DEMO_PREFIX}%`) },
    })
    if (seeded > 0) return

    const members = await this.membersRepository.find()

    const membersByStore = new Map<string, string[]>()
    members.forEach((member) => {
      const names = membersByStore.get(member.storeId) || []
      names.push(member.name)
      membersByStore.set(member.storeId, names)
    })

    const today = startOfDay(new Date())
    const now = new Date()
    const maxHour = Math.min(20, now.getHours())
    let sequence = 0
    const orders: SalesOrderEntity[] = []

    for (let offset = DAYS - 1; offset >= 0; offset -= 1) {
      const day = addDays(today, -offset)
      if (offset === 0 && maxHour < 11) continue

      for (let storeIndex = 0; storeIndex < stores.length; storeIndex += 1) {
        const store = stores[storeIndex]
        const random = mulberry32(offset * 97 + storeIndex * 13 + 7)
        const perDay = 2 + Math.floor(random() * 3)

        for (let index = 0; index < perDay; index += 1) {
          sequence += 1
          const hour =
            9 + Math.floor(random() * Math.max(maxHour - 9 + 1, 1))
          const minute = Math.floor(random() * 12) * 5
          const createdAt = new Date(
            day.getFullYear(),
            day.getMonth(),
            day.getDate(),
            hour,
            minute,
          )

          const names = membersByStore.get(store.id) || []
          const memberName =
            names.length && random() > 0.35
              ? names[Math.floor(random() * names.length)]
              : '到店顾客'

          const itemCount = 1 + Math.floor(random() * 3)
          const picked = new Set<number>()
          const items: SalesOrderItemEntity[] = []

          for (let line = 0; line < itemCount; line += 1) {
            let productIndex = Math.floor(random() * products.length)
            while (picked.has(productIndex) && picked.size < products.length) {
              productIndex = (productIndex + 1) % products.length
            }
            picked.add(productIndex)

            const product = products[productIndex]
            const quantity = 1 + Math.floor(random() * 4)
            const unitPrice = Number(product.price)
            items.push(
              this.itemsRepository.create({
                sku: product.id,
                name: product.name,
                quantity,
                unitPrice,
                amount: round(unitPrice * quantity),
              }),
            )
          }

          const amount = round(
            items.reduce((sum, item) => sum + Number(item.amount), 0),
          )
          const roll = random()
          const status =
            roll < 0.04
              ? 'refunded'
              : roll < 0.1
                ? 'partially_refunded'
                : 'paid'
          const refundedAmount =
            status === 'refunded'
              ? amount
              : status === 'partially_refunded'
                ? round(amount * 0.25)
                : 0

          orders.push(
            this.ordersRepository.create({
              id: `${DEMO_PREFIX}${dayKey(day)}-${String(sequence).padStart(4, '0')}`,
              storeId: store.id,
              storeName: store.name,
              memberName,
              itemCount: items.length,
              amount,
              paymentMethod:
                PAYMENT_METHODS[
                  Math.floor(random() * PAYMENT_METHODS.length)
                ],
              status,
              refundedAmount,
              refundReason:
                status === 'paid' ? null : '演示数据：会员部分退货',
              createdAt,
              items,
            }),
          )
        }
      }
    }

    for (let index = 0; index < orders.length; index += 100) {
      await this.ordersRepository.save(orders.slice(index, index + 100))
    }

    this.logger.log(`Seeded ${orders.length} demo sales orders`)
  }
}
