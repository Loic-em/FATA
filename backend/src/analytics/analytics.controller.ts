import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsQueryDto } from "./dto/analytics-query.dto";
import { RecordEventDto } from "./dto/record-event.dto";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post("events")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  recordEvent(@Body() dto: RecordEventDto) {
    return this.analytics.recordEvent(dto);
  }

  @Get("seller")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SELLER")
  sellerReport(@Req() request: Request & { user: AuthenticatedUser }, @Query() query: AnalyticsQueryDto) {
    return this.analytics.getSellerReport(request.user.id, query);
  }

  @Get("admin")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  adminReport(@Query() query: AnalyticsQueryDto) {
    return this.analytics.getAdminReport(query);
  }
}
