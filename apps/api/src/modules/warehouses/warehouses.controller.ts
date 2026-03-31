import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { StockMovementDto } from './dto/stock-movement.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN) // склади доступні тільки адміну
@Controller('warehouses')
export class WarehousesController {
  constructor(private warehousesService: WarehousesService) {}

  // GET /api/warehouses — список складів
  @Get()
  findAll() {
    return this.warehousesService.findAll();
  }

  // GET /api/warehouses/stock/all — залишки по всіх складах
  @Get('stock/all')
  getAllStock() {
    return this.warehousesService.getAllStock();
  }

  // GET /api/warehouses/:id/stock — залишки конкретного складу
  @Get(':id/stock')
  getStock(@Param('id') id: string) {
    return this.warehousesService.getStock(id);
  }

  // GET /api/warehouses/movements?warehouseId=...&productId=...
  @Get('movements')
  getMovements(
    @Query('warehouseId') warehouseId?: string,
    @Query('productId') productId?: string,
  ) {
    return this.warehousesService.getMovements(warehouseId, productId);
  }

  // POST /api/warehouses — створити склад
  @Post()
  create(@Body() dto: CreateWarehouseDto) {
    return this.warehousesService.create(dto);
  }

  // POST /api/warehouses/movement — зафіксувати рух товару
  @Post('movement')
  createMovement(@Body() dto: StockMovementDto, @Request() req) {
    return this.warehousesService.createMovement(dto, req.user.id);
  }

  // PATCH /api/warehouses/:id — оновити склад
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehousesService.update(id, dto);
  }

  // PATCH /api/warehouses/:id/toggle — активувати/деактивувати
  @Patch(':id/toggle')
  toggle(@Param('id') id: string) {
    return this.warehousesService.toggle(id);
  }

  @Get('suppliers')
  findAllSuppliers() {
    return this.warehousesService.findAllSuppliers();
  }

  @Post('suppliers')
  createSupplier(
    @Body() dto: { name: string; edrpou?: string; contact?: string },
  ) {
    return this.warehousesService.createSupplier(dto);
  }

  @Patch('suppliers/:id')
  updateSupplier(
    @Param('id') id: string,
    @Body() dto: { name?: string; edrpou?: string; contact?: string },
  ) {
    return this.warehousesService.updateSupplier(id, dto);
  }

  @Patch('suppliers/:id/toggle')
  toggleSupplier(@Param('id') id: string) {
    return this.warehousesService.toggleSupplier(id);
  }

  // ─── Додай в warehouses.controller.ts ────────────────────────────────────────

  @Post('production')
  createProduction(
    @Body()
    dto: {
      inputs: {
        warehouseId: string;
        productId: string;
        quantity: number;
        form: string;
      }[];
      outputs: {
        productId: string;
        quantity: number;
        form: string;
        pricePerKg?: number;
      }[];
      note?: string;
    },
  ) {
    return this.warehousesService.createProduction(dto);
  }
}
