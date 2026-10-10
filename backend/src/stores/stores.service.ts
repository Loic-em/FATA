import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateStoreDto } from "./dto/update-store.dto";

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  list(query?: string) {
    const needle = query?.trim();
    return this.prisma.store.findMany({
      where: {
        status: "APPROVED",
        ...(needle ? {
          OR: [
            { name: { contains: needle, mode: "insensitive" } },
            { description: { contains: needle, mode: "insensitive" } },
            { city: { contains: needle, mode: "insensitive" } },
          ],
        } : {}),
      },
      include: {
        products: {
          where: { active: true, category: { active: true, OR: [{ parentId: null }, { parent: { is: { active: true } } }] } },
          select: { id: true },
        },
      },
      orderBy: { name: "asc" },
      take: 100,
    });
  }

  get(id: string) {
    return this.prisma.store.findFirst({
      where: { OR: [{ id }, { slug: id }], status: "APPROVED" },
      include: {
        products: {
          where: { active: true, category: { active: true, OR: [{ parentId: null }, { parent: { is: { active: true } } }] } },
          include: {
            category: { select: { id: true, name: true, slug: true, parent: { select: { id: true, name: true, slug: true } } } },
            store: { select: { id: true, name: true, slug: true, city: true, category: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  listSellerApplications() {
    return this.prisma.store.findMany({
      where: { status: { in: ["PENDING", "APPROVED", "REJECTED"] }, sellerId: { not: null } },
      include: {
        seller: { select: { id: true, name: true, email: true, sellerStatus: true, createdAt: true } },
        _count: { select: { products: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  getMine(sellerId: string) {
    return this.prisma.store.findUnique({
      where: { sellerId },
      include: { _count: { select: { products: true } } },
    });
  }

  async updateMine(sellerId: string, dto: UpdateStoreDto) {
    const store = await this.prisma.store.findUnique({
      where: { sellerId },
      select: { id: true, status: true },
    });
    if (!store) throw new NotFoundException("Aucune boutique n’est associée à ce compte.");
    if (store.status !== "APPROVED") {
      throw new ForbiddenException("Seules les boutiques approuvées peuvent modifier leur profil public.");
    }
    return this.prisma.store.update({
      where: { id: store.id },
      data: {
        description: dto.description.trim(),
        city: dto.city.trim(),
        ...(dto.category === undefined ? {} : { category: dto.category.trim() }),
        ...(dto.image === undefined ? {} : { image: dto.image?.trim() || null }),
      },
      include: { _count: { select: { products: true } } },
    });
  }

  async reviewSeller(storeId: string, status: "APPROVED" | "REJECTED") {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, sellerId: true },
    });
    if (!store?.sellerId) throw new NotFoundException("Demande vendeur introuvable.");
    return this.prisma.$transaction([
      this.prisma.store.update({ where: { id: storeId }, data: { status } }),
      this.prisma.user.update({ where: { id: store.sellerId }, data: { sellerStatus: status } }),
    ]);
  }
}
