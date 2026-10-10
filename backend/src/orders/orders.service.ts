import { randomUUID } from "node:crypto";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateFulfillmentDto } from "./dto/update-fulfillment.dto";

const orderInclude = {
  items: { select: { id: true, productId: true, name: true, price: true, quantity: true } },
} as const;

type FulfillmentStatus = "PENDING" | "PREPARING" | "READY_FOR_PICKUP" | "SHIPPED" | "DELIVERED";
type FulfillmentRow = {
  id: string;
  orderId: string;
  storeId: string;
  storeName: string;
  status: FulfillmentStatus;
  trackingCode: string | null;
  updatedAt: Date;
  orderStatus: string;
  deliveryType: string;
  city: string;
  address: string;
  phone: string;
  instructions: string | null;
  customerName: string;
  orderCreatedAt: Date;
};
type FulfillmentEventRow = {
  id: string;
  fulfillmentId: string;
  status: FulfillmentStatus;
  note: string | null;
  createdAt: Date;
};
type FulfillmentItemRow = {
  fulfillmentId: string;
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
};

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(customer: AuthenticatedUser, dto: CreateOrderDto) {
    const quantities = new Map<string, number>();
    for (const item of dto.items) {
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    }

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: [...quantities.keys()] },
        active: true,
        store: { status: "APPROVED" },
        category: { active: true, OR: [{ parentId: null }, { parent: { is: { active: true } } }] },
      },
      select: { id: true, name: true, price: true, stock: true, storeId: true },
    });
    if (products.length !== quantities.size) {
      throw new BadRequestException("Un ou plusieurs produits ne sont plus disponibles.");
    }

    let subtotal = 0;
    const lines = products.map(product => {
      const quantity = quantities.get(product.id)!;
      if (product.stock < quantity) {
        throw new BadRequestException(`Stock insuffisant pour « ${product.name} ».`);
      }
      subtotal += product.price * quantity;
      return { productId: product.id, name: product.name, price: product.price, quantity };
    });

    const [platformSettings] = await this.prisma.$queryRaw<{ deliveryFeeAbidjan: number; deliveryFeeGrandBassam: number; deliveryFeeOther: number }[]>`
      SELECT "deliveryFeeAbidjan", "deliveryFeeGrandBassam", "deliveryFeeOther"
      FROM "PlatformSettings" WHERE "id" = 'main'
    `;
    const shipping = dto.deliveryType === "PICKUP"
      ? 0
      : dto.city === "Abidjan" ? platformSettings?.deliveryFeeAbidjan ?? 2000
        : dto.city === "Grand-Bassam" ? platformSettings?.deliveryFeeGrandBassam ?? 1000
          : platformSettings?.deliveryFeeOther ?? 3500;

    const order = await this.prisma.$transaction(async tx => {
      const created = await tx.order.create({
        data: {
          customerId: customer.id,
          status: "AWAITING_PAYMENT",
          subtotal,
          shipping,
          total: subtotal + shipping,
          city: dto.city,
          address: dto.address,
          phone: dto.phone,
          deliveryType: dto.deliveryType,
          instructions: dto.instructions?.trim() || null,
          items: { create: lines },
        },
        include: orderInclude,
      });

      // One fulfillment per boutique keeps multi-vendor orders private and actionable per seller.
      for (const storeId of new Set(products.map(product => product.storeId))) {
        const fulfillmentId = randomUUID();
        await tx.$executeRaw`
          INSERT INTO "OrderFulfillment" ("id", "orderId", "storeId", "createdAt", "updatedAt")
          VALUES (${fulfillmentId}, ${created.id}, ${storeId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
        await tx.$executeRaw`
          INSERT INTO "FulfillmentEvent" ("id", "fulfillmentId", "status", "note", "createdAt")
          VALUES (${randomUUID()}, ${fulfillmentId}, 'PENDING'::"FulfillmentStatus", 'Commande enregistrée', CURRENT_TIMESTAMP)
        `;
      }
      return created;
    });

    return (await this.attachFulfillments([order]))[0];
  }

  async listMine(customerId: string) {
    const orders = await this.prisma.order.findMany({
      where: { customerId },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return this.attachFulfillments(orders);
  }

  async listAllForAdmin() {
    const orders = await this.prisma.order.findMany({
      include: {
        customer: { select: { id: true, name: true, email: true } },
        items: { select: { id: true, productId: true, name: true, price: true, quantity: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return this.attachFulfillments(orders);
  }

  async getMine(customerId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, customerId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException("Commande introuvable.");
    return (await this.attachFulfillments([order]))[0];
  }

  async listSellerFulfillments(sellerId: string) {
    const store = await this.prisma.store.findFirst({
      where: { sellerId, status: "APPROVED" },
      select: { id: true },
    });
    if (!store) throw new ForbiddenException("Votre boutique approuvée est introuvable.");

    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT f."id"
      FROM "OrderFulfillment" f
      JOIN "Order" o ON o."id" = f."orderId"
      WHERE f."storeId" = ${store.id} AND o."status" IN ('PAID', 'TEST_PAID')
      ORDER BY f."updatedAt" DESC
      LIMIT 100
    `;
    return this.loadFulfillmentDetails(rows.map(row => row.id));
  }

  async updateSellerFulfillment(sellerId: string, fulfillmentId: string, dto: UpdateFulfillmentDto) {
    const store = await this.prisma.store.findFirst({
      where: { sellerId, status: "APPROVED" },
      select: { id: true, name: true },
    });
    if (!store) throw new ForbiddenException("Votre boutique approuvée est introuvable.");

    await this.prisma.$transaction(async tx => {
      const [current] = await tx.$queryRaw<{ status: FulfillmentStatus; deliveryType: string; orderId: string; customerId: string }[]>`
        SELECT f."status", o."deliveryType", o."id" AS "orderId", o."customerId"
        FROM "OrderFulfillment" f
        JOIN "Order" o ON o."id" = f."orderId"
        WHERE f."id" = ${fulfillmentId}
          AND f."storeId" = ${store.id}
          AND o."status" IN ('PAID', 'TEST_PAID')
        FOR UPDATE OF f
      `;
      if (!current) throw new NotFoundException("Commande introuvable ou paiement non confirmé.");

      const allowed = current.status === "PENDING" && dto.status === "PREPARING"
        || current.status === "PREPARING" && current.deliveryType === "PICKUP" && dto.status === "READY_FOR_PICKUP"
        || current.status === "PREPARING" && current.deliveryType === "DELIVERY" && dto.status === "SHIPPED";
      if (!allowed) throw new BadRequestException("Cette étape ne correspond pas à l'état actuel de la commande.");

      const trackingCode = dto.trackingCode?.trim() || null;
      await tx.$executeRaw`
        UPDATE "OrderFulfillment"
        SET "status" = ${dto.status}::"FulfillmentStatus",
            "trackingCode" = COALESCE(${trackingCode}, "trackingCode"),
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${fulfillmentId}
      `;
      await tx.$executeRaw`
        INSERT INTO "FulfillmentEvent" ("id", "fulfillmentId", "status", "note", "actorId", "createdAt")
        VALUES (${randomUUID()}, ${fulfillmentId}, ${dto.status}::"FulfillmentStatus", ${this.eventNote(dto.status)}, ${sellerId}, CURRENT_TIMESTAMP)
      `;
      const notification = this.customerNotification(dto.status, store.name, trackingCode);
      await tx.$executeRaw`
        INSERT INTO "Notification" ("id", "userId", "orderId", "type", "title", "body", "createdAt")
        VALUES (${randomUUID()}, ${current.customerId}, ${current.orderId}, 'ORDER_FULFILLMENT_UPDATED', ${notification.title}, ${notification.body}, CURRENT_TIMESTAMP)
      `;
    });

    return (await this.loadFulfillmentDetails([fulfillmentId]))[0];
  }

  async confirmReceived(customerId: string, orderId: string, fulfillmentId: string) {
    await this.prisma.$transaction(async tx => {
      const [current] = await tx.$queryRaw<{ status: FulfillmentStatus; deliveryType: string; sellerId: string | null }[]>`
        SELECT f."status", o."deliveryType", s."sellerId"
        FROM "OrderFulfillment" f
        JOIN "Order" o ON o."id" = f."orderId"
        JOIN "Store" s ON s."id" = f."storeId"
        WHERE f."id" = ${fulfillmentId}
          AND f."orderId" = ${orderId}
          AND o."customerId" = ${customerId}
          AND o."status" IN ('PAID', 'TEST_PAID')
        FOR UPDATE OF f
      `;
      if (!current) throw new NotFoundException("Commande introuvable ou paiement non confirmé.");
      if (current.status === "DELIVERED") return;
      const canConfirm = current.deliveryType === "PICKUP"
        ? current.status === "READY_FOR_PICKUP"
        : current.status === "SHIPPED";
      if (!canConfirm) throw new BadRequestException("La boutique n'a pas encore signalé la remise de cette commande.");

      await tx.$executeRaw`
        UPDATE "OrderFulfillment"
        SET "status" = 'DELIVERED'::"FulfillmentStatus", "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${fulfillmentId}
      `;
      await tx.$executeRaw`
        INSERT INTO "FulfillmentEvent" ("id", "fulfillmentId", "status", "note", "actorId", "createdAt")
        VALUES (${randomUUID()}, ${fulfillmentId}, 'DELIVERED'::"FulfillmentStatus", 'Réception confirmée par le client', ${customerId}, CURRENT_TIMESTAMP)
      `;
      if (current.sellerId) {
        await tx.$executeRaw`
          INSERT INTO "Notification" ("id", "userId", "orderId", "type", "title", "body", "createdAt")
          VALUES (${randomUUID()}, ${current.sellerId}, ${orderId}, 'ORDER_RECEIVED', 'Réception confirmée', 'Le client a confirmé la réception de sa commande.', CURRENT_TIMESTAMP)
        `;
      }
    });

    return (await this.loadFulfillmentDetails([fulfillmentId]))[0];
  }

  private async attachFulfillments<T extends { id: string }>(orders: T[]) {
    if (!orders.length) return orders.map(order => ({ ...order, fulfillments: [] }));
    const rows = await this.prisma.$queryRaw<{ id: string; orderId: string }[]>(Prisma.sql`
      SELECT "id", "orderId"
      FROM "OrderFulfillment"
      WHERE "orderId" IN (${Prisma.join(orders.map(order => order.id))})
      ORDER BY "createdAt" ASC
    `);
    const details = await this.loadFulfillmentDetails(rows.map(row => row.id));
    const byOrderId = new Map<string, typeof details>();
    for (const row of rows) {
      const list = byOrderId.get(row.orderId) ?? [];
      const detail = details.find(item => item.id === row.id);
      if (detail) list.push(detail);
      byOrderId.set(row.orderId, list);
    }
    return orders.map(order => ({ ...order, fulfillments: byOrderId.get(order.id) ?? [] }));
  }

  private async loadFulfillmentDetails(ids: string[]) {
    if (!ids.length) return [];
    const predicate = Prisma.sql`IN (${Prisma.join(ids)})`;
    const [fulfillments, events, items] = await Promise.all([
      this.prisma.$queryRaw<FulfillmentRow[]>(Prisma.sql`
        SELECT f."id", f."orderId", f."storeId", s."name" AS "storeName", f."status", f."trackingCode", f."updatedAt",
               o."status" AS "orderStatus", o."deliveryType", o."city", o."address", o."phone", o."instructions",
               u."name" AS "customerName", o."createdAt" AS "orderCreatedAt"
        FROM "OrderFulfillment" f
        JOIN "Store" s ON s."id" = f."storeId"
        JOIN "Order" o ON o."id" = f."orderId"
        JOIN "User" u ON u."id" = o."customerId"
        WHERE f."id" ${predicate}
        ORDER BY f."createdAt" ASC
      `),
      this.prisma.$queryRaw<FulfillmentEventRow[]>(Prisma.sql`
        SELECT e."id", e."fulfillmentId", e."status", e."note", e."createdAt"
        FROM "FulfillmentEvent" e
        WHERE e."fulfillmentId" ${predicate}
        ORDER BY e."createdAt" ASC
      `),
      this.prisma.$queryRaw<FulfillmentItemRow[]>(Prisma.sql`
        SELECT f."id" AS "fulfillmentId", i."id", i."productId", i."name", i."price", i."quantity"
        FROM "OrderFulfillment" f
        JOIN "OrderItem" i ON i."orderId" = f."orderId"
        JOIN "Product" p ON p."id" = i."productId" AND p."storeId" = f."storeId"
        WHERE f."id" ${predicate}
        ORDER BY i."id" ASC
      `),
    ]);

    const eventMap = new Map<string, FulfillmentEventRow[]>();
    for (const event of events) eventMap.set(event.fulfillmentId, [...(eventMap.get(event.fulfillmentId) ?? []), event]);
    const itemMap = new Map<string, FulfillmentItemRow[]>();
    for (const item of items) itemMap.set(item.fulfillmentId, [...(itemMap.get(item.fulfillmentId) ?? []), item]);
    return fulfillments.map(fulfillment => ({
      ...fulfillment,
      events: eventMap.get(fulfillment.id) ?? [],
      items: itemMap.get(fulfillment.id) ?? [],
    }));
  }

  private eventNote(status: FulfillmentStatus) {
    if (status === "PREPARING") return "Préparation commencée par la boutique";
    if (status === "READY_FOR_PICKUP") return "Commande prête à être retirée";
    if (status === "SHIPPED") return "Commande confiée au transporteur";
    return null;
  }

  private customerNotification(status: FulfillmentStatus, storeName: string, trackingCode: string | null) {
    if (status === "PREPARING") {
      return { title: "Votre commande est en préparation", body: `${storeName} a commencé à préparer vos articles.` };
    }
    if (status === "READY_FOR_PICKUP") {
      return { title: "Votre commande est prête", body: `Vos articles sont prêts à être retirés chez ${storeName}.` };
    }
    return {
      title: "Votre commande a été expédiée",
      body: trackingCode
        ? `${storeName} a expédié vos articles. Référence de suivi : ${trackingCode}.`
        : `${storeName} a confié vos articles au transporteur.`,
    };
  }
}
