import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CreateProductReviewDto } from "./dto/create-product-review.dto";
import { ReviewsService } from "./reviews.service";

@Controller("products/:productId/reviews")
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@Param("productId") productId: string) {
    return this.reviews.listForProduct(productId);
  }

  @Get("eligibility")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CLIENT")
  getEligibility(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param("productId") productId: string,
  ) {
    return this.reviews.getEligibility(request.user, productId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CLIENT")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param("productId") productId: string,
    @Body() dto: CreateProductReviewDto,
  ) {
    return this.reviews.create(request.user, productId, dto);
  }
}
