import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditService } from '../audit/audit.service'
import { CategoryEntity } from '../database/entities/category.entity'
import { ProductEntity } from '../database/entities/product.entity'
import { SupplierEntity } from '../database/entities/supplier.entity'
import {
  CATEGORY_SEED,
  PRODUCT_SEED,
  SUPPLIER_SEED,
} from '../domain/phase2-data'
import { ensurePermission } from '../domain/permissions'
import { Actor } from '../domain/types'

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatDateTime(date: Date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toProductDto(entity: ProductEntity) {
  return {
    id: entity.id,
    name: entity.name,
    category: entity.category,
    price: Number(entity.price),
    costPrice: Number(entity.costPrice || 0),
    unit: entity.unit,
    status: entity.status,
    safetyStock: entity.safetyStock,
    createdAt: formatDateTime(entity.createdAt),
    updatedAt: formatDateTime(entity.updatedAt),
  }
}

@Injectable()
export class CatalogService implements OnModuleInit {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categoriesRepository: Repository<CategoryEntity>,
    @InjectRepository(ProductEntity)
    private readonly productsRepository: Repository<ProductEntity>,
    @InjectRepository(SupplierEntity)
    private readonly suppliersRepository: Repository<SupplierEntity>,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    if ((await this.categoriesRepository.count()) === 0) {
      await this.categoriesRepository.save(
        CATEGORY_SEED.map((item) =>
          this.categoriesRepository.create(item),
        ),
      )
    }

    if ((await this.productsRepository.count()) === 0) {
      const now = new Date()
      await this.productsRepository.save(
        PRODUCT_SEED.map((item) =>
          this.productsRepository.create({
            ...item,
            createdAt: now,
            updatedAt: now,
          }),
        ),
      )
    }

    if ((await this.suppliersRepository.count()) === 0) {
      await this.suppliersRepository.save(
        SUPPLIER_SEED.map((item) =>
          this.suppliersRepository.create(item),
        ),
      )
    }
  }

  async listCategories(actor: Actor) {
    ensurePermission(actor, 'products.read', '查看商品分类')
    return this.categoriesRepository.find({ order: { sort: 'ASC' } })
  }

  async listProducts(
    actor: Actor,
    query: { search?: string; category?: string; status?: string },
  ) {
    ensurePermission(actor, 'products.read', '查看商品')
    const qb = this.productsRepository.createQueryBuilder('product')

    const search = String(query.search || '').trim()
    if (search) {
      qb.andWhere(
        '(product.name LIKE :keyword OR product.id LIKE :keyword)',
        { keyword: `%${search}%` },
      )
    }
    if (query.category && query.category !== 'all') {
      qb.andWhere('product.category = :category', {
        category: query.category,
      })
    }
    if (query.status && query.status !== 'all') {
      qb.andWhere('product.status = :status', {
        status: query.status,
      })
    }

    qb.orderBy('product.updatedAt', 'DESC')
    const rows = await qb.getMany()
    return rows.map(toProductDto)
  }

  async createProduct(
    actor: Actor,
    body: {
      id?: string
      name?: string
      category?: string
      price?: number
      costPrice?: number
      unit?: string
      status?: string
      safetyStock?: number
    },
  ) {
    ensurePermission(actor, 'products.write', '新增商品')
    if (!body.name || !body.category) {
      throw new BadRequestException('商品名称和分类不能为空')
    }
    const price = Number(body.price)
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException('商品价格不合法')
    }
    const costPrice = Number(body.costPrice ?? 0)
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      throw new BadRequestException('商品成本价不合法')
    }

    const id =
      body.id?.trim() ||
      `SKU-${String(Date.now()).slice(-6)}`
    const exists = await this.productsRepository.findOne({
      where: { id },
    })
    if (exists) throw new BadRequestException('SKU 已存在')

    const now = new Date()
    const entity = this.productsRepository.create({
      id,
      name: body.name.trim(),
      category: body.category,
      price,
      costPrice,
      unit: body.unit || '件',
      status: body.status === 'inactive' ? 'inactive' : 'active',
      safetyStock: Number(body.safetyStock) || 0,
      createdAt: now,
      updatedAt: now,
    })
    const saved = await this.productsRepository.save(entity)

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: '新增商品',
      object: saved.id,
      result: 'success',
      approvalId: '—',
    })

    return toProductDto(saved)
  }

  async updateProduct(
    actor: Actor,
    id: string,
    body: {
      name?: string
      category?: string
      price?: number
      costPrice?: number
      unit?: string
      safetyStock?: number
    },
  ) {
    ensurePermission(actor, 'products.write', '编辑商品')
    const entity = await this.productsRepository.findOne({
      where: { id },
    })
    if (!entity) throw new NotFoundException('商品不存在')

    if (body.name !== undefined) entity.name = body.name
    if (body.category !== undefined) entity.category = body.category
    if (body.price !== undefined) {
      const price = Number(body.price)
      if (!Number.isFinite(price) || price < 0) {
        throw new BadRequestException('商品价格不合法')
      }
      entity.price = price
    }
    if (body.costPrice !== undefined) {
      const costPrice = Number(body.costPrice)
      if (!Number.isFinite(costPrice) || costPrice < 0) {
        throw new BadRequestException('商品成本价不合法')
      }
      entity.costPrice = costPrice
    }
    if (body.unit !== undefined) entity.unit = body.unit
    if (body.safetyStock !== undefined) {
      entity.safetyStock = Number(body.safetyStock) || 0
    }
    entity.updatedAt = new Date()

    const saved = await this.productsRepository.save(entity)

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: '编辑商品',
      object: saved.id,
      result: 'success',
      approvalId: '—',
    })

    return toProductDto(saved)
  }

  async toggleProduct(actor: Actor, id: string, status: string) {
    ensurePermission(actor, 'products.write', '修改商品状态')
    if (!['active', 'inactive'].includes(status)) {
      throw new BadRequestException('商品状态不合法')
    }
    const entity = await this.productsRepository.findOne({
      where: { id },
    })
    if (!entity) throw new NotFoundException('商品不存在')

    entity.status = status
    entity.updatedAt = new Date()
    const saved = await this.productsRepository.save(entity)

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: status === 'active' ? '上架商品' : '下架商品',
      object: saved.id,
      result: 'success',
      approvalId: '—',
    })

    return toProductDto(saved)
  }

  async listSuppliers(actor: Actor) {
    ensurePermission(actor, 'products.read', '查看供应商')
    return this.suppliersRepository.find({ order: { id: 'ASC' } })
  }

  async createSupplier(
    actor: Actor,
    body: {
      id?: string
      name?: string
      contact?: string
      phone?: string
      status?: string
    },
  ) {
    ensurePermission(actor, 'products.write', '新增供应商')
    if (!body.name?.trim() || !body.contact?.trim() || !body.phone?.trim()) {
      throw new BadRequestException('供应商名称、联系人和电话不能为空')
    }

    const id = body.id?.trim() || `SUP-${String(Date.now()).slice(-6)}`
    const exists = await this.suppliersRepository.findOne({ where: { id } })
    if (exists) throw new BadRequestException('供应商编号已存在')

    const entity = this.suppliersRepository.create({
      id,
      name: body.name.trim(),
      contact: body.contact.trim(),
      phone: body.phone.trim(),
      status: body.status === 'inactive' ? 'inactive' : 'active',
    })
    const saved = await this.suppliersRepository.save(entity)

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: '新增供应商',
      object: saved.id,
      result: 'success',
      approvalId: '—',
    })

    return saved
  }

  async updateSupplier(
    actor: Actor,
    id: string,
    body: {
      name?: string
      contact?: string
      phone?: string
      status?: string
    },
  ) {
    ensurePermission(actor, 'products.write', '编辑供应商')
    const entity = await this.suppliersRepository.findOne({ where: { id } })
    if (!entity) throw new NotFoundException('供应商不存在')

    if (body.name !== undefined) {
      if (!body.name.trim()) throw new BadRequestException('供应商名称不能为空')
      entity.name = body.name.trim()
    }
    if (body.contact !== undefined) {
      if (!body.contact.trim()) throw new BadRequestException('联系人不能为空')
      entity.contact = body.contact.trim()
    }
    if (body.phone !== undefined) {
      if (!body.phone.trim()) throw new BadRequestException('电话不能为空')
      entity.phone = body.phone.trim()
    }
    if (body.status !== undefined) {
      if (!['active', 'inactive'].includes(body.status)) {
        throw new BadRequestException('供应商状态不合法')
      }
      entity.status = body.status
    }

    const saved = await this.suppliersRepository.save(entity)

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: '编辑供应商',
      object: saved.id,
      result: 'success',
      approvalId: '—',
    })

    return saved
  }

  async createCategory(
    actor: Actor,
    body: { id?: string; name?: string; sort?: number },
  ) {
    ensurePermission(actor, 'products.write', '新增商品分类')
    if (!body.name?.trim()) throw new BadRequestException('分类名称不能为空')

    const id = body.id?.trim() || `CAT-${String(Date.now()).slice(-6)}`
    const exists = await this.categoriesRepository.findOne({ where: { id } })
    if (exists) throw new BadRequestException('分类编号已存在')

    const entity = this.categoriesRepository.create({
      id,
      name: body.name.trim(),
      sort: Number(body.sort) || 0,
    })
    const saved = await this.categoriesRepository.save(entity)

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: '新增商品分类',
      object: saved.id,
      result: 'success',
      approvalId: '—',
    })

    return saved
  }

  async updateCategory(
    actor: Actor,
    id: string,
    body: { name?: string; sort?: number },
  ) {
    ensurePermission(actor, 'products.write', '编辑商品分类')
    const entity = await this.categoriesRepository.findOne({ where: { id } })
    if (!entity) throw new NotFoundException('分类不存在')

    const previousName = entity.name
    if (body.name !== undefined) {
      if (!body.name.trim()) throw new BadRequestException('分类名称不能为空')
      entity.name = body.name.trim()
    }
    if (body.sort !== undefined) entity.sort = Number(body.sort) || 0

    const saved = await this.categoriesRepository.save(entity)

    if (entity.name !== previousName) {
      await this.productsRepository.update(
        { category: previousName },
        { category: entity.name },
      )
    }

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: '编辑商品分类',
      object: saved.id,
      result: 'success',
      approvalId: '—',
    })

    return saved
  }
}
