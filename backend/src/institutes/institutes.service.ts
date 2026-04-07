import { Injectable, NotFoundException, ForbiddenException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class InstituteService {
  constructor(private prisma: PrismaService) {}

  async create(adminId: string, data: {
    name: string; slug?: string; logoUrl?: string; address?: string;
    phone?: string; description?: string; themeColor?: string;
  }) {
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const existing = await this.prisma.institute.findUnique({ where: { slug } });
    if (existing) throw new ConflictException("Institute slug already taken. Choose a different name.");

    const institute = await this.prisma.institute.create({ data: { ...data, slug } });

    await this.prisma.adminInstitute.create({
      data: { adminId, instituteId: institute.id, isOwner: true },
    });

    // Set admin orgId if not set
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin?.orgId) {
      await this.prisma.user.update({ where: { id: adminId }, data: { orgId: institute.id } });
    }

    return institute;
  }

  async findMyInstitutes(adminId: string) {
    const links = await this.prisma.adminInstitute.findMany({
      where: { adminId },
      include: {
        institute: {
          include: {
            _count: { select: { users: true, classes: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return links.map((l) => ({ ...l.institute, isOwner: l.isOwner }));
  }

  async findOne(id: string) {
    const inst = await this.prisma.institute.findUnique({
      where: { id },
      include: {
        admins: {
          include: {
            admin: { select: { id: true, email: true, profile: { select: { fullName: true, avatarUrl: true } } } },
          },
        },
        _count: { select: { users: true, classes: true } },
      },
    });
    if (!inst) throw new NotFoundException("Institute not found");
    return inst;
  }

  async update(id: string, adminId: string, data: {
    name?: string; logoUrl?: string; address?: string;
    phone?: string; description?: string; themeColor?: string;
  }) {
    await this.validateAccess(id, adminId);
    return this.prisma.institute.update({ where: { id }, data });
  }

  async addAdmin(instituteId: string, requesterId: string, adminEmail: string) {
    await this.validateAccess(instituteId, requesterId);
    const adminUser = await this.prisma.user.findUnique({ where: { email: adminEmail } });
    if (!adminUser || adminUser.role !== "ADMIN") throw new NotFoundException("Admin user not found");

    const existing = await this.prisma.adminInstitute.findUnique({
      where: { adminId_instituteId: { adminId: adminUser.id, instituteId } },
    });
    if (existing) throw new ConflictException("Admin already has access to this institute");

    return this.prisma.adminInstitute.create({
      data: { adminId: adminUser.id, instituteId, isOwner: false },
    });
  }

  async removeAdmin(instituteId: string, requesterId: string, adminId: string) {
    const link = await this.prisma.adminInstitute.findUnique({
      where: { adminId_instituteId: { adminId: requesterId, instituteId } },
    });
    if (!link || !link.isOwner) throw new ForbiddenException("Only the owner can remove admins");
    if (adminId === requesterId) throw new ForbiddenException("Cannot remove yourself");
    return this.prisma.adminInstitute.delete({
      where: { adminId_instituteId: { adminId, instituteId } },
    });
  }

  async validateAccess(instituteId: string, adminId: string): Promise<void> {
    const link = await this.prisma.adminInstitute.findUnique({
      where: { adminId_instituteId: { adminId, instituteId } },
    });
    if (!link) throw new ForbiddenException("No access to this institute");
  }

  /** Resolve orgId from X-Institute-Id header; fallback to admin`s first institute */
  async resolveOrgId(adminId: string, headerOrgId?: string): Promise<string | null> {
    if (headerOrgId) {
      const link = await this.prisma.adminInstitute.findUnique({
        where: { adminId_instituteId: { adminId, instituteId: headerOrgId } },
      });
      if (link) return headerOrgId;
    }
    const first = await this.prisma.adminInstitute.findFirst({
      where: { adminId },
      orderBy: { createdAt: "asc" },
    });
    return first?.instituteId ?? null;
  }
}
