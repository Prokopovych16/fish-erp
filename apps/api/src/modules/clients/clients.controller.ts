import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UpsertPricesDto } from './dto/upsert-price.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, Form } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients')
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  // GET /api/clients — всі ролі можуть бачити клієнтів
  @Get()
  findAll() {
    return this.clientsService.findAll();
  }

  // GET /api/clients/:id — один клієнт з прайсами
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  // POST /api/clients — тільки ADMIN
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  // PATCH /api/clients/:id — тільки ADMIN
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  // PATCH /api/clients/:id/toggle — активувати/деактивувати
  @Roles(UserRole.ADMIN)
  @Patch(':id/toggle')
  toggle(@Param('id') id: string) {
    return this.clientsService.toggle(id);
  }

  // GET /api/clients/:id/prices?form=FORM_1 — прайс клієнта
  // form — необов'язковий query параметр
  @Get(':id/prices')
  getPrices(@Param('id') id: string, @Query('form') form?: Form) {
    return this.clientsService.getPrices(id, form);
  }

  // PUT /api/clients/:id/prices — зберегти ціни
  @Roles(UserRole.ADMIN)
  @Patch(':id/prices')
  upsertPrices(@Param('id') id: string, @Body() dto: UpsertPricesDto) {
    return this.clientsService.upsertPrices(id, dto);
  }

  @Get(':id/delivery-points')
  getDeliveryPoints(@Param('id') id: string) {
    return this.clientsService.getDeliveryPoints(id);
  }

  @Post(':id/delivery-points')
  createDeliveryPoint(
    @Param('id') id: string,
    @Body() dto: { name: string; address?: string },
  ) {
    return this.clientsService.createDeliveryPoint(id, dto);
  }

  @Patch('delivery-points/:pointId')
  updateDeliveryPoint(
    @Param('pointId') pointId: string,
    @Body() dto: { name?: string; address?: string },
  ) {
    return this.clientsService.updateDeliveryPoint(pointId, dto);
  }

  @Patch('delivery-points/:pointId/toggle')
  toggleDeliveryPoint(@Param('pointId') pointId: string) {
    return this.clientsService.toggleDeliveryPoint(pointId);
  }
}
