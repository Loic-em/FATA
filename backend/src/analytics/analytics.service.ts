import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RecordEventDto } from "./dto/record-event.dto";

export type AnalyticsQuery = {
  period?: string;
  sellerId?: string;
  productId?: string;
  status?: string;
  paymentMethod?: string;
  city?: string;
};

type Period = "today" | "7d" | "30d" | "3m" | "1y";
type TrendRow = { period: Date; orders: number; revenue: bigint | number };

type EventType = RecordEventDto["eventType"];
const eventTypes: readonly string[] = ["VISIT", "STORE_VIEW", "PRODUCT_VIEW", "CART_ADD", "FAVORITE_ADD"];
const productEventTypes: EventType[] = ["PRODUCT_VIEW", "CART_ADD", "FAVORITE_ADD"];

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordEvent(dto: RecordEventDto) {
    const eventType: EventType = dto.eventType;
    if (!eventTypes.includes(eventType)) throw new BadRequestException("Événement analytics inconnu.");

    let productId = "";
    let storeId = "";
    if (productEventTypes.includes(eventType)) {
      if (!dto.productId) throw new BadRequestException("Un produit est nécessaire pour cet événement.");
      const product = await this.prisma.product.findFirst({
        where: {
          id: dto.productId,
          active: true,
          store: { status: "APPROVED" },
          category: { active: true, OR: [{ parentId: null }, { parent: { is: { active: true } } }] },
        },
        select: { id: true, storeId: true },
      });
      if (!product) throw new BadRequestException("Ce produit n'est pas disponible dans le catalogue.");
      productId = product.id;
      storeId = product.storeId;
    } else if (eventType === "STORE_VIEW") {
      if (!dto.storeId) throw new BadRequestException("Une boutique est nécessaire pour cet événement.");
      const store = await this.prisma.store.findFirst({
        where: { id: dto.storeId, status: "APPROVED" },
        select: { id: true },
      });
      if (!store) throw new BadRequestException("Cette boutique n'est pas disponible.");
      storeId = store.id;
    } else if (dto.productId || dto.storeId) {
      throw new BadRequestException("Une visite du site ne contient pas d'identifiant de produit ou de boutique.");
    }

    const now = new Date();
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "AnalyticsDailyAggregate" ("id", "day", "eventType", "productId", "storeId", "count", "updatedAt")
      VALUES (${randomUUID()}, ${day}, ${eventType}::"AnalyticsEventType", ${productId}, ${storeId}, 1, ${now})
      ON CONFLICT ("day", "eventType", "productId", "storeId")
      DO UPDATE SET "count" = "AnalyticsDailyAggregate"."count" + 1, "updatedAt" = EXCLUDED."updatedAt"
    `);
    return { accepted: true };
  }

  async getSellerReport(userId: string, query: AnalyticsQuery) {
    const store = await this.prisma.store.findUnique({ where: { sellerId: userId }, select: { id: true } });
    if (!store) throw new NotFoundException("Aucune boutique n'est associée à ce compte vendeur.");
    return this.getReport(query, store.id, false);
  }

  getAdminReport(query: AnalyticsQuery) {
    return this.getReport(query, query.sellerId?.trim() || undefined, true);
  }

  private async getReport(query: AnalyticsQuery, storeId: string | undefined, isAdmin: boolean) {
    const now = new Date();
    const period = this.normalizePeriod(query.period);
    const { from, bucket } = this.periodRange(period, now);
    const endOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const productId = query.productId?.trim() || undefined;
    const status = query.status?.trim() || undefined;
    const paymentMethod = query.paymentMethod?.trim() || undefined;
    const city = query.city?.trim() || undefined;
    const productWhere: Prisma.ProductWhereInput = {
      ...(storeId ? { storeId } : {}),
      ...(productId ? { id: productId } : {}),
    };
    const orderWhere: Prisma.OrderWhereInput = {
      createdAt: { gte: from, lte: now },
      ...(status ? { status } : {}),
      ...(paymentMethod ? { paymentMethod } : {}),
      ...(city ? { city } : {}),
      ...(storeId || productId ? { items: { some: { product: productWhere } } } : {}),
    };

    const bucketDates = this.makeBuckets(from, now, bucket);
    const seriesMap = new Map(bucketDates.map(date => [this.bucketKey(date, bucket), {
      key: this.bucketKey(date, bucket),
      label: this.bucketLabel(date, bucket),
      visits: 0,
      storeViews: 0,
      productViews: 0,
      cartAdds: 0,
      favorites: 0,
      orders: 0,
      revenue: 0,
    }]));

    const [eventRows, trendRows, orderStatuses, paymentStatuses, productStats, orderCount, productCount, topEventRows, stores, products, paymentMethods, cities, newClients, sellerStatusCounts] = await Promise.all([
      this.getEventSeries(from, endOfToday, { storeId, productId }),
      this.getOrderTrend(from, now, bucket, { storeId, productId, status, paymentMethod, city }),
      this.prisma.order.groupBy({ by: ["status"], where: orderWhere, _count: { _all: true } }),
      this.prisma.paymentAttempt.groupBy({ by: ["status"], where: { order: orderWhere }, _count: { _all: true } }),
      this.prisma.product.aggregate({ where: productWhere, _avg: { rating: true }, _sum: { reviews: true } }),
      this.prisma.order.count({ where: orderWhere }),
      this.prisma.product.count({ where: productWhere }),
      this.getTopProductEvents(from, endOfToday, { storeId, productId }),
      isAdmin ? this.prisma.store.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }) : Promise.resolve([]),
      this.prisma.product.findMany({
        where: productWhere,
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: 1000,
      }),
      isAdmin ? this.prisma.order.findMany({ where: { paymentMethod: { not: null } }, distinct: ["paymentMethod"], select: { paymentMethod: true }, orderBy: { paymentMethod: "asc" } }) : Promise.resolve([]),
      isAdmin ? this.prisma.order.findMany({ distinct: ["city"], select: { city: true }, orderBy: { city: "asc" } }) : Promise.resolve([]),
      isAdmin ? this.prisma.user.count({ where: { createdAt: { gte: from, lte: now } } }) : Promise.resolve(0),
      isAdmin ? this.prisma.store.groupBy({ by: ["status"], _count: { _all: true } }) : Promise.resolve([]),
    ]);

    for (const row of eventRows) {
      const target = seriesMap.get(this.bucketKey(row.day, bucket));
      if (!target) continue;
      const count = row.count;
      if (row.eventType === "VISIT") target.visits += count;
      else if (row.eventType === "STORE_VIEW") target.storeViews += count;
      else if (row.eventType === "PRODUCT_VIEW") target.productViews += count;
      else if (row.eventType === "CART_ADD") target.cartAdds += count;
      else if (row.eventType === "FAVORITE_ADD") target.favorites += count;
    }
    for (const row of trendRows) {
      const target = seriesMap.get(this.bucketKey(row.period, bucket));
      if (!target) continue;
      target.orders = row.orders;
      target.revenue = Number(row.revenue);
    }

    const topCounts = new Map<string, { views: number; cartAdds: number; favorites: number }>();
    for (const row of topEventRows) {
      const counts = topCounts.get(row.productId) ?? { views: 0, cartAdds: 0, favorites: 0 };
      const count = row.count;
      if (row.eventType === "PRODUCT_VIEW") counts.views = count;
      if (row.eventType === "CART_ADD") counts.cartAdds = count;
      if (row.eventType === "FAVORITE_ADD") counts.favorites = count;
      topCounts.set(row.productId, counts);
    }
    const topProductIds = [...topCounts.entries()].sort((a, b) => b[1].views - a[1].views).slice(0, 5);
    const soldRows = await this.getProductSales(from, now, { storeId, productId, status, paymentMethod, city });
    const performanceIds = [...new Set([...topProductIds.map(([id]) => id), ...soldRows.map(row => row.productId)])];
    const performanceProductRows = performanceIds.length
      ? await this.prisma.product.findMany({
        where: { id: { in: performanceIds } },
        select: { id: true, name: true, rating: true, reviews: true },
      })
      : [];
    const productsById = new Map(performanceProductRows.map(product => [product.id, product]));
    const topViewed = topProductIds.map(([id, counts]) => ({
      id,
      name: productsById.get(id)?.name ?? "Produit retiré",
      ...counts,
    }));
    const soldByProduct = new Map(soldRows.map(row => [row.productId, row]));
    const topSold = soldRows.map(row => ({
      id: row.productId,
      name: productsById.get(row.productId)?.name ?? "Produit retiré",
      units: Number(row.units),
      revenue: Number(row.revenue),
    }));
    const productPerformance = performanceIds.map(id => {
      const product = productsById.get(id);
      const activity = topCounts.get(id) ?? { views: 0, cartAdds: 0, favorites: 0 };
      const sales = soldByProduct.get(id);
      return {
        id,
        name: product?.name ?? "Produit retiré",
        ...activity,
        units: Number(sales?.units ?? 0),
        revenue: Number(sales?.revenue ?? 0),
        rating: product?.rating ?? 0,
        reviews: product?.reviews ?? 0,
      };
    }).sort((left, right) => right.views - left.views || right.units - left.units || left.name.localeCompare(right.name, "fr"));

    const sum = (field: "visits" | "storeViews" | "productViews" | "cartAdds" | "favorites" | "orders" | "revenue") =>
      [...seriesMap.values()].reduce((total, point) => total + point[field], 0);
    const statusCounts = Object.fromEntries(orderStatuses.map(row => [row.status, row._count._all]));
    const paymentCounts = Object.fromEntries(paymentStatuses.map(row => [row.status, row._count._all]));
    const sellerCounts = Object.fromEntries(sellerStatusCounts.map(row => [row.status, row._count._all]));

    return {
      period,
      bucket,
      totals: {
        visits: sum("visits"),
        storeViews: sum("storeViews"),
        productViews: sum("productViews"),
        cartAdds: sum("cartAdds"),
        favorites: sum("favorites"),
        orders: orderCount,
        paidRevenue: sum("revenue"),
        averageRating: Number(productStats._avg.rating ?? 0),
        reviewCount: productStats._sum.reviews ?? 0,
      },
      series: [...seriesMap.values()],
      orderStatuses: statusCounts,
      paymentStatuses: paymentCounts,
      topViewed,
      topSold,
      productPerformance,
      ...(isAdmin ? {
        platform: {
          usersCreatedInPeriod: newClients,
          sellers: sellerCounts,
          products: productCount,
        },
        filterOptions: {
          sellers: stores,
          products,
          statuses: ["AWAITING_PAYMENT", "TEST_PAID", "PAID", "CANCELLED"],
          paymentMethods: paymentMethods.flatMap(row => row.paymentMethod ? [row.paymentMethod] : []),
          cities: cities.map(row => row.city),
        },
      } : {}),
    };
  }

  private async getOrderTrend(
    from: Date,
    now: Date,
    bucket: "day" | "month",
    filters: { storeId?: string; productId?: string; status?: string; paymentMethod?: string; city?: string },
  ): Promise<TrendRow[]> {
    const conditions = this.orderSqlConditions(from, now, filters);
    const periodExpression = bucket === "month" ? Prisma.sql`DATE_TRUNC('month', o."createdAt")` : Prisma.sql`DATE_TRUNC('day', o."createdAt")`;
    const productConditions = [
      ...(filters.storeId ? [Prisma.sql`p."storeId" = ${filters.storeId}`] : []),
      ...(filters.productId ? [Prisma.sql`p."id" = ${filters.productId}`] : []),
    ];
    const revenueExpression = filters.storeId || filters.productId
      ? Prisma.sql`(SELECT COALESCE(SUM(oi."price" * oi."quantity"), 0) FROM "OrderItem" oi JOIN "Product" p ON p."id" = oi."productId" WHERE oi."orderId" = o."id" AND ${Prisma.join(productConditions, " AND ")})`
      : Prisma.sql`o."total"`;
    return this.prisma.$queryRaw<TrendRow[]>(Prisma.sql`
      SELECT ${periodExpression} AS "period",
        COUNT(*)::int AS "orders",
        COALESCE(SUM(CASE WHEN o."status" = 'PAID' THEN ${revenueExpression} ELSE 0 END), 0)::bigint AS "revenue"
      FROM "Order" o
      WHERE ${Prisma.join(conditions, " AND ")}
      GROUP BY ${periodExpression}
      ORDER BY ${periodExpression} ASC
    `);
  }

  private getEventSeries(
    from: Date,
    endOfToday: Date,
    filters: { storeId?: string; productId?: string },
  ) {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`"day" >= ${from}`,
      Prisma.sql`"day" < ${endOfToday}`,
    ];
    if (filters.storeId) conditions.push(Prisma.sql`"storeId" = ${filters.storeId}`);
    if (filters.productId) conditions.push(Prisma.sql`"productId" = ${filters.productId}`);
    return this.prisma.$queryRaw<{ day: Date; eventType: EventType; count: number }[]>(Prisma.sql`
      SELECT "day", "eventType", SUM("count")::int AS "count"
      FROM "AnalyticsDailyAggregate"
      WHERE ${Prisma.join(conditions, " AND ")}
      GROUP BY "day", "eventType"
    `);
  }

  private getTopProductEvents(
    from: Date,
    endOfToday: Date,
    filters: { storeId?: string; productId?: string },
  ) {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`"day" >= ${from}`,
      Prisma.sql`"day" < ${endOfToday}`,
      Prisma.sql`"eventType" IN ('PRODUCT_VIEW', 'CART_ADD', 'FAVORITE_ADD')`,
      Prisma.sql`"productId" <> ''`,
    ];
    if (filters.storeId) conditions.push(Prisma.sql`"storeId" = ${filters.storeId}`);
    if (filters.productId) conditions.push(Prisma.sql`"productId" = ${filters.productId}`);
    return this.prisma.$queryRaw<{ productId: string; eventType: EventType; count: number }[]>(Prisma.sql`
      SELECT "productId", "eventType", SUM("count")::int AS "count"
      FROM "AnalyticsDailyAggregate"
      WHERE ${Prisma.join(conditions, " AND ")}
      GROUP BY "productId", "eventType"
    `);
  }

  private async getProductSales(
    from: Date,
    now: Date,
    filters: { storeId?: string; productId?: string; status?: string; paymentMethod?: string; city?: string },
  ) {
    if (filters.status && filters.status !== "PAID") return [];
    const conditions = this.orderSqlConditions(from, now, filters);
    conditions.push(Prisma.sql`o."status" = 'PAID'`);
    const productConditions = [
      ...(filters.storeId ? [Prisma.sql`p."storeId" = ${filters.storeId}`] : []),
      ...(filters.productId ? [Prisma.sql`p."id" = ${filters.productId}`] : []),
    ];
    if (!productConditions.length) productConditions.push(Prisma.sql`TRUE`);
    return this.prisma.$queryRaw<{ productId: string; units: bigint; revenue: bigint }[]>(Prisma.sql`
      SELECT oi."productId", SUM(oi."quantity")::bigint AS "units",
        SUM(oi."price" * oi."quantity")::bigint AS "revenue"
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      JOIN "Product" p ON p."id" = oi."productId"
      WHERE ${Prisma.join(conditions, " AND ")}
        AND oi."productId" IN (SELECT p."id" FROM "Product" p WHERE ${Prisma.join(productConditions, " AND ")})
      GROUP BY oi."productId"
      ORDER BY SUM(oi."quantity") DESC
      LIMIT 5
    `);
  }

  private orderSqlConditions(
    from: Date,
    now: Date,
    filters: { storeId?: string; productId?: string; status?: string; paymentMethod?: string; city?: string },
  ): Prisma.Sql[] {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`o."createdAt" >= ${from}`,
      Prisma.sql`o."createdAt" <= ${now}`,
    ];
    if (filters.status) conditions.push(Prisma.sql`o."status" = ${filters.status}`);
    if (filters.paymentMethod) conditions.push(Prisma.sql`o."paymentMethod" = ${filters.paymentMethod}`);
    if (filters.city) conditions.push(Prisma.sql`o."city" = ${filters.city}`);
    if (filters.storeId || filters.productId) {
      const itemConditions: Prisma.Sql[] = [Prisma.sql`oi."orderId" = o."id"`];
      if (filters.storeId) itemConditions.push(Prisma.sql`p."storeId" = ${filters.storeId}`);
      if (filters.productId) itemConditions.push(Prisma.sql`p."id" = ${filters.productId}`);
      conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "OrderItem" oi JOIN "Product" p ON p."id" = oi."productId" WHERE ${Prisma.join(itemConditions, " AND ")})`);
    }
    return conditions;
  }

  private normalizePeriod(value?: string): Period {
    const allowed: Period[] = ["today", "7d", "30d", "3m", "1y"];
    if (!value) return "30d";
    if (!allowed.includes(value as Period)) throw new BadRequestException("Période analytics invalide.");
    return value as Period;
  }

  private periodRange(period: Period, now: Date) {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    let bucket: "day" | "month" = "day";
    if (period === "7d") from.setUTCDate(from.getUTCDate() - 6);
    if (period === "30d") from.setUTCDate(from.getUTCDate() - 29);
    if (period === "3m") {
      from.setUTCMonth(from.getUTCMonth() - 2);
      from.setUTCDate(1);
      bucket = "month";
    }
    if (period === "1y") {
      from.setUTCMonth(from.getUTCMonth() - 11, 1);
      bucket = "month";
    }
    return { from, bucket };
  }

  private makeBuckets(from: Date, now: Date, bucket: "day" | "month") {
    const dates: Date[] = [];
    const cursor = new Date(from);
    while (cursor <= now) {
      dates.push(new Date(cursor));
      if (bucket === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      else cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
  }

  private bucketKey(date: Date, bucket: "day" | "month") {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    return bucket === "month" ? `${year}-${month}` : `${year}-${month}-${String(date.getUTCDate()).padStart(2, "0")}`;
  }

  private bucketLabel(date: Date, bucket: "day" | "month") {
    return new Intl.DateTimeFormat("fr-FR", bucket === "month"
      ? { month: "short", year: "2-digit", timeZone: "UTC" }
      : { day: "2-digit", month: "short", timeZone: "UTC" }).format(date);
  }
}
