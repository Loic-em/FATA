import { Body, Controller, Get, NotFoundException, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { StoresService } from "./stores.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { ReviewSellerDto } from "./dto/review-seller.dto";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UpdateStoreDto } from "./dto/update-store.dto";

@Controller("stores")
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Get()
  list(@Query("q") query?: string) {
    return this.stores.list(query);
  }

  @Get("mine")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SELLER")
  async getMine(@Req() request: Request & { user: AuthenticatedUser }) {
    const store = await this.stores.getMine(request.user.id);
    if (!store) throw new NotFoundException("Aucune boutique n’est associée à ce compte.");
    return store;
  }

  @Patch("mine")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SELLER")
  updateMine(@Req() request: Request & { user: AuthenticatedUser }, @Body() dto: UpdateStoreDto) {
    return this.stores.updateMine(request.user.id, dto);
  }

  @Get("admin/sellers")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  listSellerApplications() {
    return this.stores.listSellerApplications();
  }

  @Patch("admin/sellers/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  reviewSeller(@Param("id") id: string, @Body() dto: ReviewSellerDto) {
    return this.stores.reviewSeller(id, dto.status);
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const store = await this.stores.get(id);
    if (!store) throw new NotFoundException("Boutique introuvable.");
    return store;
  }
}
