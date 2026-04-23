import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards,
  UploadedFile, UseInterceptors, Headers, Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ClassesService } from './classes.service';
import { UploadService } from '../upload/upload.service';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';
import { CreateMonthDto, UpdateMonthDto } from './dto/month.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('classes')
export class ClassesController {
  constructor(
    private classesService: ClassesService,
    private uploadService: UploadService,
  ) {}

  // ─── Classes CRUD (Admin) ─────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  createClass(@Request() req: any, @Headers('x-institute-id') orgId: string | undefined, @Body() body: CreateClassDto) {
    return this.classesService.createClass({ ...body, orgId: orgId || undefined });
  }

  @Get()
  findAll(@Headers('x-institute-id') orgId?: string) {
    return this.classesService.findAll(orgId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.classesService.findOne(id);
  }

  /** Authenticated: check if user has access to an ENROLLED_ONLY class */
  @UseGuards(JwtAuthGuard)
  @Get(':id/check-access')
  checkClassAccess(@Param('id') id: string, @Request() req: any) {
    return this.classesService.checkClassAccess(id, req.user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  updateClass(@Param('id') id: string, @Body() body: UpdateClassDto) {
    return this.classesService.updateClass(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  deleteClass(@Param('id') id: string) {
    return this.classesService.deleteClass(id);
  }

  // ─── Class Thumbnail Upload ────────────────────────────

  /**
   * POST /classes/:id/thumbnail
   * Upload a thumbnail image for a class to S3 and update the class record.
   * Form field name: "file"
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post(':id/thumbnail')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadThumbnail(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const uploaded = await this.uploadService.uploadImage(file, 'classes');
    await this.classesService.updateClass(id, { thumbnail: uploaded.responseUrl });
    return {
      thumbnail: uploaded.responseUrl,
      incomingUrl: uploaded.incomingUrl,
      responseUrl: uploaded.responseUrl,
    };
  }

  // ─── Class Recordings (aggregated from all months) ────

  @Get(':classId/recordings')
  getRecordingsForClass(@Param('classId') classId: string) {
    return this.classesService.getRecordingsForClass(classId);
  }

  // ─── Months ───────────────────────────────────────────

  /** Global: list all months across all classes */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('months/all')
  findAllMonths() {
    return this.classesService.findAllMonths();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post(':classId/months')
  createMonth(
    @Param('classId') classId: string,
    @Body() body: CreateMonthDto,
  ) {
    return this.classesService.createMonth(classId, body);
  }

  @Get(':classId/months')
  findMonths(@Param('classId') classId: string) {
    return this.classesService.findMonthsByClass(classId);
  }

  @Get('months/:id')
  findMonth(@Param('id') id: string) {
    return this.classesService.findMonth(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('months/:id')
  updateMonth(@Param('id') id: string, @Body() body: UpdateMonthDto) {
    return this.classesService.updateMonth(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete('months/:id')
  deleteMonth(@Param('id') id: string) {
    return this.classesService.deleteMonth(id);
  }
}
