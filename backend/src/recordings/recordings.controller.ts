import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, Request, ForbiddenException,
} from '@nestjs/common';
import { RecordingsService } from './recordings.service';
import { AccessResolverService } from './access-resolver.service';
import { CreateRecordingDto, UpdateRecordingDto } from './dto/recording.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('recordings')
export class RecordingsController {
  constructor(
    private recordingsService: RecordingsService,
    private accessResolver: AccessResolverService,
  ) {}

  // ─── Admin CRUD ────────────────────────────────────────

  /** Admin: list all recordings */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get()
  findAll() {
    return this.recordingsService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  create(@Body() body: CreateRecordingDto) {
    return this.recordingsService.create(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateRecordingDto) {
    return this.recordingsService.update(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.recordingsService.delete(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get(':id/watch-history')
  getWatchHistory(@Param('id') id: string) {
    return this.recordingsService.getWatchHistory(id);
  }

  // ─── Live Lecture Endpoints ────────────────────────────

  /** Admin: start a live session */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post(':id/go-live')
  goLive(@Param('id') id: string) {
    return this.recordingsService.goLive(id);
  }

  /** Admin: end a live session */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post(':id/end-live')
  endLive(@Param('id') id: string) {
    return this.recordingsService.endLive(id);
  }

  /** Admin: get live attendance for a recording */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get(':id/live-attendance')
  getLiveAttendance(@Param('id') id: string) {
    return this.recordingsService.getLiveAttendance(id);
  }

  /** Student: join a live lecture via shareable token (marks attendance + returns live URL) */
  @UseGuards(JwtAuthGuard)
  @Post('live/:token/join')
  async joinLive(@Param('token') token: string, @Request() req: any) {
    const recording = await this.recordingsService.findByLiveToken(token);
    // Mark live attendance
    await this.recordingsService.markLiveAttendance(req.user.sub, recording.id);
    return {
      recording: {
        id: recording.id,
        title: recording.title,
        liveUrl: recording.liveUrl,
        isLive: recording.isLive,
        liveEndedAt: recording.liveEndedAt,
        videoUrl: recording.videoUrl,
        videoType: recording.videoType,
        month: recording.month,
      },
    };
  }

  /** Resolve a live token (public info — used before auth to know what the lecture is) */
  @UseGuards(OptionalJwtAuthGuard)
  @Get('live/:token')
  async resolveLiveToken(@Param('token') token: string, @Request() req: any) {
    const recording = await this.recordingsService.findByLiveToken(token);
    return {
      id: recording.id,
      title: recording.title,
      isLive: recording.isLive,
      liveEndedAt: recording.liveEndedAt,
      videoUrl: recording.videoUrl,
      videoType: recording.videoType,
      className: recording.month?.class?.name,
      monthName: recording.month?.name,
      isAuthenticated: !!req.user,
    };
  }

  // ─── Access-controlled endpoints ───────────────────────

  /** Get recordings for a month (visibility-filtered) */
  @UseGuards(OptionalJwtAuthGuard)
  @Get('by-month/:monthId')
  getByMonth(@Param('monthId') monthId: string, @Request() req: any) {
    const userId = req.user?.sub;
    const role = req.user?.role;
    return this.accessResolver.getVisibleRecordingsForMonth(monthId, userId, role);
  }

  /** Get single recording (access-checked) */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.sub;
    const role = req.user?.role;

    const canAccess = await this.accessResolver.canAccessRecording(id, userId, role);
    if (!canAccess) {
      throw new ForbiddenException('You do not have access to this recording');
    }

    return this.recordingsService.findOne(id);
  }
}
