import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get('active')
  findActive() {
    return this.productsService.findActive();
  }

  @Get('groups')
  findAllGroups() {
    return this.productsService.findAllGroups();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Post('groups')
  createGroup(@Body('name') name: string) {
    return this.productsService.createGroup(name);
  }

  @Roles(UserRole.ADMIN)
  @Patch('groups/:id')
  updateGroup(@Param('id') id: string, @Body('name') name: string) {
    return this.productsService.updateGroup(id, name);
  }

  @Roles(UserRole.ADMIN)
  @Delete('groups/:id')
  deleteGroup(@Param('id') id: string) {
    return this.productsService.deleteGroup(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/toggle')
  toggle(@Param('id') id: string) {
    return this.productsService.toggle(id);
  }
}
