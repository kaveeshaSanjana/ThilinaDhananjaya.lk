import { Controller, Post, Get, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto, ManualAttendanceDto, StartSessionDto, HeartbeatDto, EndSessionDto } from './dto/attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  /** Public: get the required push duration and heartbeat interval */
  @Get('config')
  getConfig() {
    return {
      pushDurationSeconds: this.attendanceService.getPushDuration(),
      heartbeatIntervalSeconds: this.attendanceService.getHeartbeatInterval(),
    };
  }

  /** Student: "push" event — mark attendance as completed */
  @UseGuards(JwtAuthGuard)
  @Post('mark')
  markCompleted(
    @Request() req: any,
    @Body() body: MarkAttendanceDto,
  ) {
    return this.attendanceService.markCompleted(req.user.sub, body.recordingId, body.watchedSec);
  }

  /** Student: log incomplete attempt (before unload) */
  @UseGuards(JwtAuthGuard)
  @Post('incomplete')
  markIncomplete(
    @Request() req: any,
    @Body() body: MarkAttendanceDto,
  ) {
    return this.attendanceService.markIncomplete(req.user.sub, body.recordingId, body.watchedSec);
  }

  /** Admin: manually mark attendance */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('manual')
  manualMark(@Body() body: ManualAttendanceDto) {
    return this.attendanceService.manualMark(body);
  }

  /** Admin: all attendance records — optional filters: classId, recordingId, status */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get()
  getAll(
    @Query('classId') classId?: string,
    @Query('recordingId') recordingId?: string,
    @Query('status') status?: string,
  ) {
    return this.attendanceService.getAll({ classId, recordingId, status });
  }

  /** Student: my attendance history */
  @UseGuards(JwtAuthGuard)
  @Get('my')
  getMyAttendance(@Request() req: any) {
    return this.attendanceService.getByUser(req.user.sub);
  }

  /** Admin: attendance for a student */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('user/:userId')
  getUserAttendance(@Param('userId') userId: string) {
    return this.attendanceService.getByUser(userId);
  }

  /** Admin: attendance for a recording */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('recording/:recordingId')
  getRecordingAttendance(@Param('recordingId') recordingId: string) {
    return this.attendanceService.getByRecording(recordingId);
  }

  /** Admin: attendance for all recordings in a class */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('class/:classId')
  getClassAttendance(@Param('classId') classId: string) {
    return this.attendanceService.getByClass(classId);
  }

  // ─── Watch Session Endpoints ────────────────────────────

  /** Student: start a new watch session */
  @UseGuards(JwtAuthGuard)
  @Post('session/start')
  startSession(
    @Request() req: any,
    @Body() body: StartSessionDto,
  ) {
    return this.attendanceService.startSession(req.user.sub, body.recordingId, body.videoPosition, body.events);
  }

  /** Student: heartbeat — update current watch session */
  @UseGuards(JwtAuthGuard)
  @Post('session/heartbeat')
  heartbeat(
    @Request() req: any,
    @Body() body: HeartbeatDto,
  ) {
    return this.attendanceService.heartbeat(req.user.sub, body.sessionId, body.videoPosition, body.watchedSec, body.events);
  }

  /** Student: end a watch session */
  @UseGuards(JwtAuthGuard)
  @Post('session/end')
  endSession(
    @Request() req: any,
    @Body() body: EndSessionDto,
  ) {
    return this.attendanceService.endSession(req.user.sub, body.sessionId, body.videoPosition, body.watchedSec, body.events);
  }

  /** End session via sendBeacon — no auth required (sendBeacon can't send headers) */
  @Post('session/end-beacon')
  endSessionBeacon(@Body() body: EndSessionDto) {
    return this.attendanceService.endSessionBySessionId(body.sessionId, body.videoPosition, body.watchedSec, body.events);
  }

  /** Student: my watch history (all sessions) */
  @UseGuards(JwtAuthGuard)
  @Get('watch-history/my')
  getMyWatchHistory(@Request() req: any) {
    return this.attendanceService.getWatchHistory(req.user.sub);
  }

  /** Student: my sessions for a specific recording */
  @UseGuards(JwtAuthGuard)
  @Get('watch-history/recording/:recordingId')
  getMyRecordingSessions(
    @Request() req: any,
    @Param('recordingId') recordingId: string,
  ) {
    return this.attendanceService.getSessionsByRecording(req.user.sub, recordingId);
  }

  /** Admin: watch sessions for a specific recording */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('watch-history/admin/recording/:recordingId')
  getRecordingWatchHistory(@Param('recordingId') recordingId: string) {
    return this.attendanceService.getRecordingWatchHistory(recordingId);
  }

  /** Admin: all watch sessions */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('watch-sessions')
  getAllWatchSessions() {
    return this.attendanceService.getAllWatchSessions();
  }

  /** Admin: watch sessions for a specific class */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('watch-sessions/class/:classId')
  getClassWatchSessions(@Param('classId') classId: string) {
    return this.attendanceService.getWatchSessionsByClass(classId);
  }
}
