import { Controller, Get, Post, Patch, Delete, Param, Body, Request, UseGuards } from "@nestjs/common";
import { InstituteService } from "./institutes.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@Controller("institutes")
export class InstituteController {
  constructor(private readonly instituteService: InstituteService) {}

  /** Create a new institute (admin becomes owner) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Post()
  create(
    @Request() req: any,
    @Body() body: { name: string; logoUrl?: string; address?: string; phone?: string; description?: string; themeColor?: string },
  ) {
    return this.instituteService.create(req.user.sub, body);
  }

  /** Get all institutes the current admin manages */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Get("my")
  getMyInstitutes(@Request() req: any) {
    return this.instituteService.findMyInstitutes(req.user.sub);
  }

  /** Get a single institute by ID */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.instituteService.findOne(id);
  }

  /** Update institute settings */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Request() req: any,
    @Body() body: { name?: string; logoUrl?: string; address?: string; phone?: string; description?: string; themeColor?: string },
  ) {
    return this.instituteService.update(id, req.user.sub, body);
  }

  /** Add another admin to an institute */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Post(":id/admins")
  addAdmin(@Param("id") id: string, @Request() req: any, @Body("email") email: string) {
    return this.instituteService.addAdmin(id, req.user.sub, email);
  }

  /** Remove an admin from an institute (owner only) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Delete(":id/admins/:adminId")
  removeAdmin(@Param("id") id: string, @Param("adminId") adminId: string, @Request() req: any) {
    return this.instituteService.removeAdmin(id, req.user.sub, adminId);
  }
}
