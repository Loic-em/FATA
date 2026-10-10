import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  list(filters: { category?: string; query?: string; ids?: string[] }) {
    const query = filters.query?.trim();
    return this.prisma.product.findMany({
      where: {
        ...(filters.ids === undefined ? {} : { id: { in: filters.ids } }),
        active: true,
        store: { status: "APPROVED" },
        category: {
          active: true,
          AND: [
            { OR: [{ parentId: null }, { parent: { is: { active: true } } }] },
            ...(filters.category ? [{ OR: [{ slug: filters.category }, { parent: { is: { slug: filters.category } } }] }] : []),
          ],
        },
        ...(query ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        } : {}),
      },
      include: {
        category: { select: { id: true, name: true, slug: true, parent: { select: { id: true, name: true, slug: true } } } },
        store: { select: { id: true, name: true, slug: true, city: true, category: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  get(id: string) {
    return this.prisma.product.findFirst({
      where: {
        id,
        active: true,
        store: { status: "APPROVED" },
        category: { active: true, OR: [{ parentId: null }, { parent: { is: { active: true } } }] },
      },
      include: {
        category: { select: { id: true, name: true, slug: true, parent: { select: { id: true, name: true, slug: true } } } },
        store: { select: { id: true, name: true, slug: true, city: true, category: true } },
      },
    });
  }

  listAllForAdmin() {
    return this.prisma.product.findMany({
      include: {
        category: { select: { id: true, name: true, slug: true, parentId: true, parent: { select: { id: true, name: true, slug: true } } } },
        store: { select: { id: true, name: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  listMine(seller: AuthenticatedUser) {
    return this.prisma.product.findMany({
      where: { store: { sellerId: seller.id } },
      include: {
        category: { select: { id: true, name: true, slug: true, parentId: true, parent: { select: { id: true, name: true, slug: true } } } },
        store: { select: { id: true, name: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async createForSeller(seller: AuthenticatedUser, dto: CreateProductDto) {
    const store = await this.prisma.store.findUnique({
      where: { sellerId: seller.id },
      select: { id: true, status: true },
    });
    if (!store) throw new NotFoundException("Aucune boutique n’est associée à ce compte.");
    if (store.status !== "APPROVED") {
      throw new ForbiddenException("Votre boutique doit être approuvée avant de proposer des produits.");
    }
    const category = await this.prisma.category.findFirst({
      where: {
        id: dto.categoryId,
        active: true,
        OR: [{ parentId: null }, { parent: { is: { active: true } } }],
      },
      select: { id: true },
    });
    if (!category) throw new NotFoundException("Choisissez une catégorie active avant de soumettre ce produit.");
    return this.prisma.product.create({
      data: {
        name: dto.name.trim(),
        description: dto.description.trim(),
        price: dto.price,
        stock: dto.stock,
        image: dto.image?.trim() || null,
        categoryId: category.id,
        storeId: store.id,
        active: false,
      },
      include: {
        category: { select: { id: true, name: true, slug: true, parent: { select: { id: true, name: true, slug: true } } } },
        store: { select: { id: true, name: true, status: true } },
      },
    });
  }

  async setActive(id: string, active: boolean) {
    const product = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) throw new NotFoundException("Produit introuvable.");
    return this.prisma.product.update({ where: { id }, data: { active } });
  }

  async updateForSeller(seller: AuthenticatedUser, id: string, dto: UpdateProductDto) {
    if (Object.values(dto).every(value => value === undefined)) {
      throw new BadRequestException("Indiquez au moins une information à modifier.");
    }
    const existing = await this.prisma.product.findFirst({
      where: { id, store: { sellerId: seller.id, status: "APPROVED" } },
      select: { id: true, categoryId: true },
    });
    if (!existing) throw new NotFoundException("Produit introuvable dans votre boutique approuvée.");
    if (dto.categoryId !== undefined && dto.categoryId !== existing.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: dto.categoryId,
          active: true,
          OR: [{ parentId: null }, { parent: { is: { active: true } } }],
        },
        select: { id: true },
      });
      if (!category) throw new NotFoundException("Choisissez une catégorie active avant de renvoyer ce produit en modération.");
    }
    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
        ...(dto.description === undefined ? {} : { description: dto.description.trim() }),
        ...(dto.price === undefined ? {} : { price: dto.price }),
        ...(dto.stock === undefined ? {} : { stock: dto.stock }),
        ...(dto.categoryId === undefined ? {} : { categoryId: dto.categoryId }),
        ...(dto.image === undefined ? {} : { image: dto.image?.trim() || null }),
        active: false,
      },
      include: {
        category: { select: { id: true, name: true, slug: true, parentId: true, parent: { select: { id: true, name: true, slug: true } } } },
        store: { select: { id: true, name: true, status: true } },
      },
    });
  }

  async updateForAdmin(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id }, select: { id: true, categoryId: true } });
    if (!existing) throw new NotFoundException("Produit introuvable.");
    if (dto.categoryId !== undefined && dto.categoryId !== existing.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: dto.categoryId,
          active: true,
          OR: [{ parentId: null }, { parent: { is: { active: true } } }],
        },
        select: { id: true },
      });
      if (!category) throw new NotFoundException("Catégorie introuvable.");
    }
    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
        ...(dto.description === undefined ? {} : { description: dto.description.trim() }),
        ...(dto.price === undefined ? {} : { price: dto.price }),
        ...(dto.stock === undefined ? {} : { stock: dto.stock }),
        ...(dto.categoryId === undefined ? {} : { categoryId: dto.categoryId }),
        ...(dto.image === undefined ? {} : { image: dto.image?.trim() || null }),
      },
      include: {
        category: { select: { id: true, name: true, slug: true, parent: { select: { id: true, name: true, slug: true } } } },
        store: { select: { id: true, name: true, status: true } },
      },
    });
  }

  async removeForAdmin(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, _count: { select: { orderItems: true, conversations: true } } },
    });
    if (!product) throw new NotFoundException("Produit introuvable.");
    if (product._count.orderItems || product._count.conversations) {
      throw new ConflictException("Ce produit est lié à des commandes ou à des conversations. Masquez-le pour le retirer du catalogue sans perdre l’historique.");
    }
    try {
      return await this.prisma.product.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new ConflictException("Ce produit vient d’être associé à une commande ou une conversation. Masquez-le pour préserver l’historique.");
      }
      throw error;
    }
  }
}
