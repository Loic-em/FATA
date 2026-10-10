import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { ReportMessageDto } from "./dto/report-message.dto";
import { SendMessageDto } from "./dto/send-message.dto";
import { MessagingService } from "./messaging.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get("conversations")
  listConversations(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.messaging.listConversations(request.user);
  }

  @Post("conversations")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  createConversation(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: CreateConversationDto,
  ) {
    return this.messaging.createConversation(request.user, dto);
  }

  @Get("conversations/:id")
  getConversation(@Req() request: Request & { user: AuthenticatedUser }, @Param("id") id: string) {
    return this.messaging.getConversation(request.user, id);
  }

  @Get("conversations/:id/messages")
  listMessages(@Req() request: Request & { user: AuthenticatedUser }, @Param("id") id: string) {
    return this.messaging.listMessages(request.user, id);
  }

  @Post("conversations/:id/messages")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  sendMessage(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param("id") id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messaging.sendMessage(request.user, id, dto);
  }

  @Patch("conversations/:id/read")
  markRead(@Req() request: Request & { user: AuthenticatedUser }, @Param("id") id: string) {
    return this.messaging.markRead(request.user, id);
  }

  @Post("messages/:id/report")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  reportMessage(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param("id") id: string,
    @Body() dto: ReportMessageDto,
  ) {
    return this.messaging.reportMessage(request.user, id, dto);
  }

  @Get("notifications")
  listNotifications(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.messaging.listNotifications(request.user);
  }

  @Patch("notifications/:id/read")
  markNotificationRead(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param("id") id: string,
  ) {
    return this.messaging.markNotificationRead(request.user, id);
  }
}
