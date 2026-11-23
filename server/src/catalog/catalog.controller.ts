import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { CatalogService } from './catalog.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@Controller('api')
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('categories')
  async categories(@Req() request: any) {
    return {
      categories: await this.catalogService.listCategories(request.actor),
    }
  }

  @Post('categories')
  async createCategory(@Req() request: any, @Body() body: any) {
    return this.catalogService.createCategory(request.actor, body)
  }

  @Patch('categories/:id')
  async updateCategory(
    @Req() request: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.catalogService.updateCategory(request.actor, id, body)
  }

  @Get('products')
  async products(
    @Req() request: any,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
  ) {
    return {
      products: await this.catalogService.listProducts(request.actor, {
        search,
        category,
        status,
      }),
    }
  }

  @Post('products')
  async createProduct(@Req() request: any, @Body() body: any) {
    return this.catalogService.createProduct(request.actor, body)
  }

  @Patch('products/:id')
  async updateProduct(
    @Req() request: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.catalogService.updateProduct(request.actor, id, body)
  }

  @Patch('products/:id/status')
  async toggleProduct(
    @Req() request: any,
    @Param('id') id: string,
    @Body() body: { status?: string },
  ) {
    return this.catalogService.toggleProduct(
      request.actor,
      id,
      String(body.status || ''),
    )
  }

  @Get('suppliers')
  async suppliers(@Req() request: any) {
    return {
      suppliers: await this.catalogService.listSuppliers(request.actor),
    }
  }

  @Post('suppliers')
  async createSupplier(@Req() request: any, @Body() body: any) {
    return this.catalogService.createSupplier(request.actor, body)
  }

  @Patch('suppliers/:id')
  async updateSupplier(
    @Req() request: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.catalogService.updateSupplier(request.actor, id, body)
  }
}
