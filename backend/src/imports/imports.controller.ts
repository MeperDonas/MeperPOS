import {
  Body,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseFilePipeBuilder,
  Post,
  Request,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrgRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrganizationRequiredGuard } from '../common/guards/organization-required.guard';
import { AdminOrganizationInterceptor } from '../common/interceptors/admin-organization.interceptor';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { ImportsService } from './imports.service';
import { MultiSheetImportService } from './multi-sheet-import.service';
import { TemplateService } from './template.service';
import {
  RetryImportRowDto,
  ImportJobStatusResponseDto,
} from './dto/import.dto';

@ApiTags('Imports')
@Controller('imports')
@UseGuards(JwtAuthGuard, RolesGuard, OrganizationRequiredGuard)
@UseInterceptors(AdminOrganizationInterceptor)
@ApiBearerAuth()
export class ImportsController {
  constructor(
    private readonly importsService: ImportsService,
    private readonly multiSheetImportService: MultiSheetImportService,
    private readonly templateService: TemplateService,
  ) {}

  @Get('products/template')
  @Roles(OrgRole.ADMIN, OrgRole.CASHIER)
  @ApiOperation({ summary: 'Download products import template' })
  async downloadTemplate(@Res() res: any): Promise<void> {
    return this.importsService.downloadTemplate(res);
  }

  @Post('products')
  @Roles(OrgRole.ADMIN, OrgRole.CASHIER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Upload inventory migration file (.xlsx / .csv)' })
  async startProductsImport(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({
          fileIsRequired: true,
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
    @Request() req: { requestId?: string } = {},
  ): Promise<any> {
    return this.importsService.startProductsImport(
      file,
      user.userId,
      user.organizationId,
      ...(req.requestId ? [req.requestId] : []),
    );
  }

  @Get('full-template')
  @Roles(OrgRole.ADMIN, OrgRole.CASHIER)
  @ApiOperation({ summary: 'Download multi-sheet import template' })
  async downloadFullTemplate(@Res() res: any): Promise<void> {
    return this.templateService.downloadTemplate(res);
  }

  @Post('full')
  @Roles(OrgRole.ADMIN, OrgRole.CASHIER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Upload multi-sheet Excel file (.xlsx)' })
  async startFullImport(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({
          fileIsRequired: true,
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
    @Request() req: { requestId?: string } = {},
  ): Promise<any> {
    return this.multiSheetImportService.startFullImport(
      file,
      user.userId,
      user.organizationId,
      ...(req.requestId ? [req.requestId] : []),
    );
  }

  @Get(':jobId/status')
  @Roles(OrgRole.ADMIN, OrgRole.CASHIER)
  @ApiOkResponse({ type: ImportJobStatusResponseDto })
  @ApiOperation({ summary: 'Get import job status for polling' })
  getImportStatus(
    @Param('jobId') jobId: string,
    @Request() req: { user: { userId: string } },
  ): any {
    const userId = req.user.userId;
    try {
      return this.importsService.getImportStatus(jobId, userId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return this.multiSheetImportService.getImportStatus(jobId, userId);
      }
      throw error;
    }
  }

  @Post(':jobId/retry-row')
  @Roles(OrgRole.ADMIN, OrgRole.CASHIER)
  @ApiOkResponse({ type: ImportJobStatusResponseDto })
  @ApiOperation({ summary: 'Retry a failed row with corrected data' })
  async retryImportRow(
    @Param('jobId') jobId: string,
    @Body() dto: RetryImportRowDto,
    @Request() req: { user: { userId: string } },
  ): Promise<any> {
    const userId = req.user.userId;

    if (dto.sheetId && dto.sheetId !== 'productos') {
      return this.multiSheetImportService.retryImportRow(jobId, userId, {
        rowIndex: dto.rowIndex,
        sheetId: dto.sheetId,
        correctedData: dto.correctedData,
      });
    }

    try {
      return this.importsService.retryImportRow(jobId, userId, dto);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return this.multiSheetImportService.retryImportRow(jobId, userId, {
          rowIndex: dto.rowIndex,
          sheetId: dto.sheetId ?? 'productos',
          correctedData: dto.correctedData,
        });
      }
      throw error;
    }
  }
}
