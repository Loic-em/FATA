import { Body, Controller, Get, Param, Patch, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { ReviewMessageReportDto } from "./dto/review-message-report.dto";
import { MessagingService } from "./messaging.service";

@Controller("admin/message-reports")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminMessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get()
  listReports() {
    return this.messaging.listReports();
  }

  @Patch(":id")
  reviewReport(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param("id") id: string,
    @Body() dto: ReviewMessageReportDto,
  ) {
    return this.messaging.reviewReport(request.user, id, dto);
  }
}
