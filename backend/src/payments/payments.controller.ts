import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards, type RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PaymentsService } from "./payments.service";
import { SimulatePaymentDto } from "./dto/simulate-payment.dto";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("geniuspay/orders/:orderId")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  startCheckout(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param("orderId") orderId: string,
  ) {
    return this.payments.startCheckout(request.user, orderId);
  }

  @Get("geniuspay/orders/:orderId")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  getPaymentStatus(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param("orderId") orderId: string,
  ) {
    return this.payments.getPaymentStatus(request.user, orderId);
  }

  @Post("simulation/orders/:orderId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CLIENT")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  simulatePayment(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param("orderId") orderId: string,
    @Body() body: SimulatePaymentDto,
  ) {
    return this.payments.simulatePayment(request.user, orderId, body.outcome);
  }

  @Get("geniuspay/admin/config")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  getAdminConfig() {
    return this.payments.getAdminConfig();
  }

  @Post("geniuspay/notify")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  notify(
    @Req() request: RawBodyRequest<Request>,
    @Body() body: Record<string, unknown>,
    @Headers("x-webhook-signature") signature?: string,
    @Headers("x-webhook-timestamp") timestamp?: string,
    @Headers("x-webhook-event") event?: string,
    @Headers("x-webhook-environment") environment?: string,
  ) {
    return this.payments.handleNotification(body, request.rawBody, { signature, timestamp, event, environment });
  }
}
