import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, Request,
} from '@nestjs/common';
import { MediaService } from './media.service';
import { CreateMediaDto, UpdateMediaDto } from './dto/media.dto';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  /** GET /media/month/:monthId — list media for a month (visibility-filtered) */
  @UseGuards(OptionalJwtAuthGuard)
  @Get('month/:monthId')
  findByMonth(@Param('monthId') monthId: string, @Request() req: any) {
    const userId: string | undefined = req.user?.sub;
    const userRole: string | undefined = req.user?.role;
    return this.mediaService.findByMonth(monthId, userId, userRole);
  }

  /** POST /media — create a new media item (Admin only) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  create(@Body() body: CreateMediaDto) {
    return this.mediaService.create(body);
  }

  /** PATCH /media/:id — update a media item (Admin only) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateMediaDto) {
    return this.mediaService.update(id, body);
  }

  /** DELETE /media/:id — delete a media item (Admin only) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.mediaService.delete(id);
  }
}
