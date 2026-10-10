import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { ProductsService } from "./products.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { SetProductActiveDto } from "./dto/set-product-active.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UpdateProductDto } from "./dto/update-product.dto";

@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query("category") category?: string, @Query("q") query?: string, @Query("ids") ids?: string) {
    const productIds = ids?.split(",").map(id => id.trim()).filter(Boolean);
    if (productIds && productIds.length > 30) {
      throw new BadRequestException("Vous pouvez vérifier au maximum 30 produits à la fois.");
    }
    return this.products.list({ category, query, ...(productIds ? { ids: productIds } : {}) });
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SELLER")
  createForSeller(@Req() request: Request & { user: AuthenticatedUser }, @Body() dto: CreateProductDto) {
    return this.products.createForSeller(request.user, dto);
  }

  @Get("mine")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SELLER")
  listMine(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.products.listMine(request.user);
  }

  @Patch("mine/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SELLER")
  updateForSeller(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param("id") id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.updateForSeller(request.user, id, dto);
  }

  @Get("admin/all")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  listAllForAdmin() {
    return this.products.listAllForAdmin();
  }

  @Patch("admin/:id/active")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  setActive(@Param("id") id: string, @Body() dto: SetProductActiveDto) {
    return this.products.setActive(id, dto.active);
  }

  @Patch("admin/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  updateForAdmin(@Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.products.updateForAdmin(id, dto);
  }

  @Delete("admin/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  removeForAdmin(@Param("id") id: string) {
    return this.products.removeForAdmin(id);
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const product = await this.products.get(id);
    if (!product) throw new NotFoundException("Produit introuvable.");
    return product;
  }
}
