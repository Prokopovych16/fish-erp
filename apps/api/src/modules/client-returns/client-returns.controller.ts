import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientReturnsService } from './client-returns.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('client-returns')
@UseGuards(JwtAuthGuard)
export class ClientReturnsController {
  constructor(private readonly service: ClientReturnsService) {}

  @Get()
  findAll(
    @Query('clientId') clientId?: string,
    @Query('resolved') resolved?: string,
  ) {
    return this.service.findAll({
      clientId,
      resolved:
        resolved === 'true' ? true : resolved === 'false' ? false : undefined,
    });
  }

  @Get('pending/:clientId')
  getPendingForClient(@Param('clientId') clientId: string) {
    return this.service.getPendingForClient(clientId);
  }

  @Get('pending-by-point/:deliveryPointId')
  getPendingForDeliveryPoint(
    @Param('deliveryPointId') deliveryPointId: string,
  ) {
    return this.service.getPendingForDeliveryPoint(deliveryPointId);
  }

  @Post()
  create(@Body() dto: any) {
    return this.service.create(dto);
  }

  @Patch(':id/resolve')
  resolve(@Param('id') id: string) {
    return this.service.resolve(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Patch(':id/process')
  process(@Param('id') id: string, @Body() dto: any) {
    return this.service.processReturn(id, dto);
  }
}
