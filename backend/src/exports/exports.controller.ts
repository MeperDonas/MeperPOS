import {
  Controller,
  Post,
  Body,
  UseGuards,
  Res,
  Get,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { OrgRole } from '@prisma/client';
import { ExportsService } from './exports.service';
import { ExportQueryDto, InventoryMovementsQueryDto } from './dto/export.dto';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';

@ApiTags('Exports')
@Controller('exports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ExportsController {
  constructor(private exportsService: ExportsService) {}

  @Get('inventory')
  @Roles(OrgRole.ADMIN, OrgRole.MEMBER)
  @ApiOperation({ summary: 'Get inventory movements (JSON, paginated)' })
  async getInventoryMovements(
    @CurrentUser() user: RequestUser,
    @Query() query: InventoryMovementsQueryDto,
  ) {
    return this.exportsService.getInventoryMovements(
      user.organizationId!,
      query,
    );
  }

  @Post('sales')
  @Roles(OrgRole.ADMIN)
  @ApiOperation({ summary: 'Export sales data' })
  @ApiConsumes('application/json')
  async exportSales(
    @CurrentUser() user: RequestUser,
    @Body() query: ExportQueryDto,
    @Res() res: Response,
  ) {
    return this.exportsService.exportSales(user.organizationId!, query, res);
  }

  @Post('products')
  @Roles(OrgRole.ADMIN, OrgRole.MEMBER)
  @ApiOperation({ summary: 'Export products data' })
  @ApiConsumes('application/json')
  async exportProducts(
    @CurrentUser() user: RequestUser,
    @Body() query: ExportQueryDto,
    @Res() res: Response,
  ) {
    return this.exportsService.exportProducts(user.organizationId!, query, res);
  }

  @Post('customers')
  @Roles(OrgRole.ADMIN)
  @ApiOperation({ summary: 'Export customers data' })
  @ApiConsumes('application/json')
  async exportCustomers(
    @CurrentUser() user: RequestUser,
    @Body() query: ExportQueryDto,
    @Res() res: Response,
  ) {
    return this.exportsService.exportCustomers(
      user.organizationId!,
      query,
      res,
    );
  }

  @Post('inventory')
  @Roles(OrgRole.ADMIN, OrgRole.MEMBER)
  @ApiOperation({ summary: 'Export inventory movements data' })
  @ApiConsumes('application/json')
  async exportInventory(
    @CurrentUser() user: RequestUser,
    @Body() query: ExportQueryDto,
    @Res() res: Response,
  ) {
    return this.exportsService.exportInventory(
      user.organizationId!,
      query,
      res,
    );
  }
}
