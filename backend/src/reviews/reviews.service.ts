import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { CreateProductReviewDto } from "./dto/create-product-review.dto";

const prohibitedContact = /(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?225[\s().-]*)?0[1-9](?:[\s().-]*\d){8}\b/i;
const phoneLike = /(?:\+?\d[\s().-]*){10,}/;

type ReviewRow = { id: string; rating: number; body: string | null; createdAt: Date; reviewerName: string };
type PurchaseRow = { orderItemId: string; orderId: string; orderDate: Date; quantity: number; reviewed: boolean };

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForProduct(productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw new NotFoundException("Produit introuvable.");

    const reviews = await this.prisma.$queryRaw<ReviewRow[]>(Prisma.sql`
      SELECT r."id", r."rating", r."body", r."createdAt", u."name" AS "reviewerName"
      FROM "ProductReview" r
      JOIN "User" u ON u."id" = r."userId"
      WHERE r."productId" = ${productId}
      ORDER BY r."createdAt" DESC
      LIMIT 50
    `);
    return reviews.map(review => ({
      id: review.id,
      rating: review.rating,
      body: review.body,
      createdAt: review.createdAt,
      reviewer: this.publicName(review.reviewerName),
      verifiedPurchase: true as const,
    }));
  }

  async getEligibility(user: AuthenticatedUser, productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw new NotFoundException("Produit introuvable.");

    const items = await this.prisma.$queryRaw<PurchaseRow[]>(Prisma.sql`
      SELECT oi."id" AS "orderItemId", o."id" AS "orderId", o."createdAt" AS "orderDate",
        oi."quantity", (r."id" IS NOT NULL) AS "reviewed"
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      LEFT JOIN "ProductReview" r ON r."orderItemId" = oi."id"
      WHERE oi."productId" = ${productId}
        AND o."customerId" = ${user.id}
        AND o."status" = 'PAID'
      ORDER BY o."createdAt" DESC
    `);
    const eligibleItems = items.filter(item => !item.reviewed);

    return {
      reviewedPurchaseCount: items.length - eligibleItems.length,
      eligiblePurchases: eligibleItems.map(item => ({
        orderItemId: item.orderItemId,
        orderId: item.orderId,
        orderDate: item.orderDate,
        quantity: item.quantity,
      })),
    };
  }

  async create(user: AuthenticatedUser, productId: string, dto: CreateProductReviewDto) {
    const purchase = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT oi."id"
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      LEFT JOIN "ProductReview" r ON r."orderItemId" = oi."id"
      WHERE oi."id" = ${dto.orderItemId}
        AND oi."productId" = ${productId}
        AND o."customerId" = ${user.id}
        AND o."status" = 'PAID'
        AND r."id" IS NULL
      LIMIT 1
    `);
    if (!purchase.length) throw new ForbiddenException("Un paiement confirmé pour ce produit est nécessaire pour déposer un avis vérifié.");

    const body = dto.body?.trim() || null;
    if (body && (prohibitedContact.test(body) || phoneLike.test(body))) {
      throw new BadRequestException("Les liens, coordonnées et numéros de téléphone ne sont pas autorisés dans un avis public.");
    }

    return this.prisma.$transaction(async transaction => {
      const id = randomUUID();
      const inserted = await transaction.$queryRaw<Array<{ id: string; createdAt: Date }>>(Prisma.sql`
        INSERT INTO "ProductReview" ("id", "productId", "userId", "orderItemId", "rating", "body", "createdAt", "updatedAt")
        VALUES (${id}, ${productId}, ${user.id}, ${dto.orderItemId}, ${dto.rating}, ${body}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("orderItemId") DO NOTHING
        RETURNING "id", "createdAt"
      `);
      if (!inserted.length) throw new ConflictException("Un avis a déjà été déposé pour cet achat.");

      await transaction.$executeRaw(Prisma.sql`
        UPDATE "Product"
        SET "rating" = (("rating" * "reviews") + ${dto.rating}) / ("reviews" + 1),
            "reviews" = "reviews" + 1,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${productId}
      `);
      const [summary, reviewer] = await Promise.all([
        transaction.product.findUnique({ where: { id: productId }, select: { rating: true, reviews: true } }),
        transaction.user.findUnique({ where: { id: user.id }, select: { name: true } }),
      ]);
      if (!summary || !reviewer) throw new NotFoundException("Produit ou compte introuvable.");

      return {
        id: inserted[0].id,
        rating: dto.rating,
        body,
        createdAt: inserted[0].createdAt,
        reviewer: this.publicName(reviewer.name),
        verifiedPurchase: true as const,
        productRating: summary.rating,
        productReviewCount: summary.reviews,
      };
    });
  }

  private publicName(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "Client FATA";
    if (parts.length === 1) return parts[0];
    const lastName = parts[parts.length - 1];
    return `${parts[0]} ${lastName[0]}.`;
  }
}
