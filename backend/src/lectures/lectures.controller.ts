import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { LecturesService } from './lectures.service';
import { CreateLectureDto, UpdateLectureDto } from './dto/lecture.dto';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

type LectureStatus = 'ANYONE' | 'STUDENTS_ONLY' | 'PAID_ONLY' | 'PRIVATE' | 'INACTIVE';

@Controller('lectures')
export class LecturesController {
  constructor(private lecturesService: LecturesService) {}

  // ─── Admin: create / update / delete ──────────────────

  /** Admin: create a lecture for a class month */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('month/:monthId')
  create(
    @Param('monthId') monthId: string,
    @Body() body: CreateLectureDto,
  ) {
    return this.lecturesService.create(monthId, body);
  }

  /** Admin: update a lecture */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateLectureDto) {
    return this.lecturesService.update(id, body);
  }

  /** Admin: delete a lecture */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.lecturesService.delete(id);
  }

  /** Admin: list all lectures with optional filters */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get()
  getAll(
    @Query('monthId') monthId?: string,
    @Query('status') status?: LectureStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.lecturesService.getAll(
      monthId,
      status,
      page ? +page : undefined,
      limit ? +limit : undefined,
    );
  }

  // ─── All users: read ───────────────────────────────────

  /** Public: resolve live token → lecture info (sessionLink hidden) */
  @UseGuards(OptionalJwtAuthGuard)
  @Get('live/:token')
  findByLiveToken(@Param('token') token: string) {
    return this.lecturesService.findByLiveToken(token);
  }

  /** Authenticated: join via live token → mark attendance, return sessionLink */
  @UseGuards(JwtAuthGuard)
  @Post('live/:token/join')
  joinByLiveToken(@Param('token') token: string, @Request() req: any) {
    return this.lecturesService.joinByLiveToken(token, req.user.id);
  }

  /** Admin: generate or regenerate the shareable liveToken for a lecture */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post(':id/generate-token')
  generateLiveToken(@Param('id') id: string) {
    return this.lecturesService.generateLiveToken(id);
  }

  /** All users: get lectures for a class month (visibility-filtered) */
  @UseGuards(OptionalJwtAuthGuard)
  @Get('month/:monthId')
  getByMonth(
    @Param('monthId') monthId: string,
    @Request() req: any,
  ) {
    return this.lecturesService.getByMonth(monthId, req.user?.role);
  }

  /** All users: get a single lecture by ID */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lecturesService.findOne(id);
  }
}
