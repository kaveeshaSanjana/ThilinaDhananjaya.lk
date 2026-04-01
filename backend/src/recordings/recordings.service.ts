import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RecordingsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    monthId: string;
    title: string;
    description?: string;
    videoUrl: string;
    thumbnail?: string;
    topic?: string;
    icon?: string;
    materials?: string;
    duration?: number;
    status?: any;
    order?: number;
  }) {
    return this.prisma.recording.create({ data });
  }

  async findAll() {
    return this.prisma.recording.findMany({
      include: { month: { include: { class: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const rec = await this.prisma.recording.findUnique({
      where: { id },
      include: { month: { include: { class: true } } },
    });
    if (!rec) throw new NotFoundException('Recording not found');
    return rec;
  }

  async update(id: string, data: {
    title?: string;
    description?: string;
    videoUrl?: string;
    thumbnail?: string;
    topic?: string;
    icon?: string;
    materials?: string;
    duration?: number;
    status?: any;
    order?: number;
  }) {
    return this.prisma.recording.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.recording.delete({ where: { id } });
  }

  /** Admin: get watch history for a specific recording */
  async getWatchHistory(recordingId: string) {
    return this.prisma.attendance.findMany({
      where: { recordingId },
      include: {
        user: {
          include: { profile: { select: { fullName: true, instituteId: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
