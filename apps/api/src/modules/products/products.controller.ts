import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  // GET /api/products — всі продукти (для панелі адміна)
  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  // GET /api/products/active — тільки активні (для форм і випадаючих списків)
  @Get('active')
  findActive() {
    return this.productsService.findActive();
  }

  // GET /api/products/:id — один продукт
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  // POST /api/products — створити (тільки ADMIN)
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  // PATCH /api/products/:id — оновити (тільки ADMIN)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  // PATCH /api/products/:id/toggle — активувати/деактивувати (тільки ADMIN)
  @Roles(UserRole.ADMIN)
  @Patch(':id/toggle')
  toggle(@Param('id') id: string) {
    return this.productsService.toggle(id);
  }
}
