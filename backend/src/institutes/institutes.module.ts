import { Module } from "@nestjs/common";
import { InstituteController } from "./institutes.controller";
import { InstituteService } from "./institutes.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [InstituteController],
  providers: [InstituteService],
  exports: [InstituteService],
})
export class InstituteModule {}
