import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { BazaarAssortmentService } from './bazaar-assortment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('bazaar-assortment')
export class BazaarAssortmentController {
  constructor(private bazaarAssortmentService: BazaarAssortmentService) {}

  @Get(':clientId')
  findForClient(@Param('clientId') clientId: string) {
    return this.bazaarAssortmentService.findForClient(clientId);
  }

  @Put(':clientId')
  replaceForClient(
    @Param('clientId') clientId: string,
    @Body() dto: { items: { productId: string; displayUnit?: string }[] },
  ) {
    return this.bazaarAssortmentService.replaceForClient(clientId, dto.items ?? []);
  }
}
