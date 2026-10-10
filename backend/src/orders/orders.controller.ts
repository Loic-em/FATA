import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { Throttle } from "@nestjs/throttler";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateFulfillmentDto } from "./dto/update-fulfillment.dto";
import { OrdersService } from "./orders.service";

@Controller("orders")
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles("CLIENT")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@Req() request: Request & { user: AuthenticatedUser }, @Body() dto: CreateOrderDto) {
    return this.orders.create(request.user, dto);
  }

  @Get("mine")
  listMine(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.orders.listMine(request.user.id);
  }

  @Get("seller/fulfillments")
  @UseGuards(RolesGuard)
  @Roles("SELLER")
  listSellerFulfillments(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.orders.listSellerFulfillments(request.user.id);
  }

  @Patch("seller/fulfillments/:fulfillmentId")
  @UseGuards(RolesGuard)
  @Roles("SELLER")
  updateSellerFulfillment(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param("fulfillmentId") fulfillmentId: string,
    @Body() dto: UpdateFulfillmentDto,
  ) {
    return this.orders.updateSellerFulfillment(request.user.id, fulfillmentId, dto);
  }

  @Post(":orderId/fulfillments/:fulfillmentId/received")
  @UseGuards(RolesGuard)
  @Roles("CLIENT")
  confirmReceived(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param("orderId") orderId: string,
    @Param("fulfillmentId") fulfillmentId: string,
  ) {
    return this.orders.confirmReceived(request.user.id, orderId, fulfillmentId);
  }

  @Get("admin/all")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  listAllForAdmin() {
    return this.orders.listAllForAdmin();
  }

  @Get(":id")
  getMine(@Req() request: Request & { user: AuthenticatedUser }, @Param("id") id: string) {
    return this.orders.getMine(request.user.id, id);
  }
}
