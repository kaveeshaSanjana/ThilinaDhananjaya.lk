import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      email: dto.email,
      password: hashedPassword,
      fullName: dto.fullName,
      phone: dto.phone,
      whatsappPhone: dto.whatsappPhone,
      address: dto.address,
      school: dto.school,
      dateOfBirth: dto.dateOfBirth,
      guardianName: dto.guardianName,
      guardianPhone: dto.guardianPhone,
      relationship: dto.relationship,
      avatarUrl: dto.avatarUrl,
    });

    const accessToken = this.generateAccessToken(user.id, user.role);
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      user: { id: user.id, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByLoginIdentifier(dto.identifier);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.verifyPassword(dto.password, user);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.generateAccessToken(user.id, user.role);
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      user: { id: user.id, email: user.email, role: user.role, profile: user.profile },
      accessToken,
      refreshToken,
    };
  }

  async refreshTokens(refreshToken: string) {
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { include: { profile: true } } },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      // Clean up expired token if it exists
      if (tokenRecord) {
        await this.prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: delete old refresh token, create new one
    await this.prisma.refreshToken.delete({ where: { id: tokenRecord.id } });

    const newAccessToken = this.generateAccessToken(tokenRecord.userId, tokenRecord.user.role);
    const newRefreshToken = await this.generateRefreshToken(tokenRecord.userId);

    return {
      user: {
        id: tokenRecord.user.id,
        email: tokenRecord.user.email,
        role: tokenRecord.user.role,
        profile: tokenRecord.user.profile,
      },
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string) {
    try {
      await this.prisma.refreshToken.delete({
        where: { token: refreshToken },
      });
    } catch {
      // Token already deleted or doesn't exist — that's fine
    }
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  async getMe(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();
    const { password, ...result } = user;
    return result;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    const isCurrentPasswordValid = await this.verifyPassword(dto.currentPassword, user);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    await this.logoutAll(userId);

    return { message: 'Password changed successfully. Please log in again.' };
  }

  private generateAccessToken(userId: string, role: string): string {
    return this.jwtService.sign({ sub: userId, role });
  }

  /**
   * Supports legacy plain-text passwords while migrating them to bcrypt.
   */
  private async verifyPassword(plainPassword: string, user: { id: string; password: string | null }): Promise<boolean> {
    const storedPassword = user.password ?? '';
    const isBcryptHash = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(storedPassword);

    if (isBcryptHash) {
      return bcrypt.compare(plainPassword, storedPassword);
    }

    if (storedPassword !== plainPassword) {
      return false;
    }

    const hashedPassword = await bcrypt.hash(plainPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return true;
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const token = randomBytes(64).toString('hex');
    const expiresIn = this.config.get('JWT_REFRESH_EXPIRES_IN', '7d');
    const expiresAt = new Date();

    // Parse duration string like "7d", "30d", "24h"
    const match = expiresIn.match(/^(\d+)([dhms])$/);
    if (match) {
      const amount = parseInt(match[1], 10);
      switch (match[2]) {
        case 'd': expiresAt.setDate(expiresAt.getDate() + amount); break;
        case 'h': expiresAt.setHours(expiresAt.getHours() + amount); break;
        case 'm': expiresAt.setMinutes(expiresAt.getMinutes() + amount); break;
        case 's': expiresAt.setSeconds(expiresAt.getSeconds() + amount); break;
      }
    } else {
      expiresAt.setDate(expiresAt.getDate() + 7); // Default 7 days
    }

    // Clean up old tokens for this user (keep max 5 sessions)
    const existingTokens = await this.prisma.refreshToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    if (existingTokens.length >= 5) {
      const tokensToDelete = existingTokens.slice(4);
      await this.prisma.refreshToken.deleteMany({
        where: { id: { in: tokensToDelete.map(t => t.id) } },
      });
    }

    await this.prisma.refreshToken.create({
      data: { userId, token, expiresAt },
    });

    return token;
  }
}
