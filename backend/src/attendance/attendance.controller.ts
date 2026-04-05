import { Controller, Post, Get, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto, ManualAttendanceDto, StartSessionDto, HeartbeatDto, EndSessionDto, MarkClassAttendanceDto, BulkClassAttendanceDto, MarkByBarcodeDto, MarkByInstituteIdDto, MarkByPhoneDto } from './dto/attendance.dto';
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
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.attendanceService.getAll({
      classId, recordingId, status,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
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

  /** Admin: aggregated student stats for a recording (sessions, watch time, etc.) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('recording/:recordingId/stats')
  getRecordingStudentStats(@Param('recordingId') recordingId: string) {
    return this.attendanceService.getRecordingStudentStats(recordingId);
  }

  /** Admin: single student's detailed watch stats for a recording */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('recording/:recordingId/student/:userId')
  getStudentRecordingStats(
    @Param('recordingId') recordingId: string,
    @Param('userId') userId: string,
  ) {
    return this.attendanceService.getStudentRecordingStats(recordingId, userId);
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
  getAllWatchSessions(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.attendanceService.getAllWatchSessions(page ? +page : undefined, limit ? +limit : undefined);
  }

  /** Admin: watch sessions for a specific class */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('watch-sessions/class/:classId')
  getClassWatchSessions(@Param('classId') classId: string) {
    return this.attendanceService.getWatchSessionsByClass(classId);
  }

  // ─── Class Attendance (Physical / Date-based) Endpoints ───

  /** Admin: mark by barcode — 1 indexed lookup, fastest (used by QR / barcode scanner) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('class-attendance/mark/by-barcode')
  markByBarcode(
    @Request() req: any,
    @Body() body: MarkByBarcodeDto,
  ) {
    return this.attendanceService.markByBarcode({ ...body, markedBy: req.user.sub });
  }

  /** Admin: mark by institute ID — 1 unique index lookup */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('class-attendance/mark/by-institute-id')
  markByInstituteId(
    @Request() req: any,
    @Body() body: MarkByInstituteIdDto,
  ) {
    return this.attendanceService.markByInstituteId({ ...body, markedBy: req.user.sub });
  }

  /** Admin: mark by phone number — 1 indexed lookup */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('class-attendance/mark/by-phone')
  markByPhone(
    @Request() req: any,
    @Body() body: MarkByPhoneDto,
  ) {
    return this.attendanceService.markByPhone({ ...body, markedBy: req.user.sub });
  }

  /** Admin: mark single student class attendance — generic fallback (up to 4 lookups) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('class-attendance/mark')
  markClassAttendance(
    @Request() req: any,
    @Body() body: MarkClassAttendanceDto,
  ) {
    return this.attendanceService.markClassAttendance({
      ...body,
      markedBy: req.user.sub,
    });
  }

  /** Admin: bulk mark attendance for a class on a date */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('class-attendance/bulk')
  bulkMarkClassAttendance(
    @Request() req: any,
    @Body() body: BulkClassAttendanceDto,
  ) {
    return this.attendanceService.bulkMarkClassAttendance({
      ...body,
      markedBy: req.user.sub,
    });
  }

  /** Admin: get class attendance for a specific date */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('class-attendance/class/:classId/date/:date')
  getClassAttendanceByDate(
    @Param('classId') classId: string,
    @Param('date') date: string,
  ) {
    return this.attendanceService.getClassAttendanceByDate(classId, date);
  }

  /** Admin: get class attendance for a month */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('class-attendance/class/:classId/month/:year/:month')
  getClassAttendanceByMonth(
    @Param('classId') classId: string,
    @Param('year') year: string,
    @Param('month') month: string,
  ) {
    return this.attendanceService.getClassAttendanceByMonth(classId, parseInt(year), parseInt(month));
  }

  /** Admin: get class attendance for an entire year */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('class-attendance/class/:classId/year/:year')
  getClassAttendanceByYear(
    @Param('classId') classId: string,
    @Param('year') year: string,
  ) {
    return this.attendanceService.getClassAttendanceByYear(classId, parseInt(year));
  }

  /** Admin: get enrolled students for a class (for attendance form) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('class-attendance/class/:classId/students')
  getEnrolledStudents(@Param('classId') classId: string) {
    return this.attendanceService.getEnrolledStudentsForClass(classId);
  }

  /** Admin: get a student's class attendance history */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('class-attendance/student/:userId')
  getStudentClassAttendance(
    @Param('userId') userId: string,
    @Query('classId') classId?: string,
  ) {
    return this.attendanceService.getStudentClassAttendance(userId, classId);
  }

  /** Admin: delete a class attendance record */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete('class-attendance/:id')
  deleteClassAttendance(@Param('id') id: string) {
    return this.attendanceService.deleteClassAttendance(id);
  }

  /** Admin: attendance monitor grid — date range */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('class-attendance/class/:classId/monitor')
  getClassAttendanceMonitor(
    @Param('classId') classId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.attendanceService.getClassAttendanceMonitor(classId, from, to);
  }

  /** Admin: get class-wise student payment statuses */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('class-attendance/class/:classId/payments')
  getClassStudentPayments(@Param('classId') classId: string) {
    return this.attendanceService.getClassStudentPayments(classId);
  }
}
