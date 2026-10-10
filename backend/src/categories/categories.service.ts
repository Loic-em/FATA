import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  listActive() {
    return this.prisma.category.findMany({
      where: {
        active: true,
        OR: [{ parentId: null }, { parent: { is: { active: true } } }],
      },
      include: { parent: { select: { id: true, name: true, slug: true } } },
      orderBy: [{ parentId: "asc" }, { name: "asc" }],
    });
  }

  listAll() {
    return this.prisma.category.findMany({
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        _count: { select: { products: true, children: true } },
      },
      orderBy: [{ parentId: "asc" }, { name: "asc" }],
    });
  }

  async create(dto: CreateCategoryDto) {
    const slug = dto.slug.trim().toLowerCase();
    if (dto.parentId) await this.assertTopLevelParent(dto.parentId);
    try {
      return await this.prisma.category.create({
        data: { name: dto.name.trim(), slug, image: dto.image?.trim() || null, parentId: dto.parentId ?? null },
        include: { parent: { select: { id: true, name: true, slug: true } } },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Le nom ou le slug de cette catégorie existe déjà.");
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true, parentId: true, _count: { select: { children: true } } },
    });
    if (!existing) throw new NotFoundException("Catégorie introuvable.");
    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) throw new ConflictException("Une catégorie ne peut pas être sa propre sous-catégorie.");
      if (existing._count.children) throw new ConflictException("Réaffectez d’abord ses sous-catégories avant de déplacer cette catégorie.");
      await this.assertTopLevelParent(dto.parentId);
    }
    try {
      return await this.prisma.category.update({
        where: { id },
        data: {
          ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
          ...(dto.slug === undefined ? {} : { slug: dto.slug.trim().toLowerCase() }),
          ...(dto.image === undefined ? {} : { image: dto.image?.trim() || null }),
          ...(dto.parentId === undefined ? {} : { parentId: dto.parentId }),
        },
        include: { parent: { select: { id: true, name: true, slug: true } } },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Le nom ou le slug de cette catégorie existe déjà.");
      }
      throw error;
    }
  }

  async remove(id: string) {
    const existing = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true, _count: { select: { products: true, children: true } } },
    });
    if (!existing) throw new NotFoundException("Catégorie introuvable.");
    if (existing._count.products) {
      throw new ConflictException("Cette catégorie contient encore des produits. Réaffectez-les ou supprimez-les avant de supprimer la catégorie.");
    }
    if (existing._count.children) {
      throw new ConflictException("Cette catégorie contient des sous-catégories. Supprimez-les ou réaffectez-les avant de supprimer la catégorie.");
    }
    try {
      return await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new ConflictException("Cette catégorie vient d’être associée à un produit. Réessayez après avoir actualisé la liste.");
      }
      throw error;
    }
  }

  async setActive(id: string, active: boolean) {
    const existing = await this.prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException("Catégorie introuvable.");
    return this.prisma.category.update({ where: { id }, data: { active } });
  }

  private async assertTopLevelParent(parentId: string) {
    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
      select: { id: true, parentId: true },
    });
    if (!parent) throw new NotFoundException("Catégorie parente introuvable.");
    if (parent.parentId) throw new ConflictException("Les sous-catégories ne peuvent pas avoir elles-mêmes des sous-catégories.");
  }
}
