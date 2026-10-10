CREATE TYPE "FulfillmentStatus" AS ENUM (
    'PENDING',
    'PREPARING',
    'READY_FOR_PICKUP',
    'SHIPPED',
    'DELIVERED'
);

CREATE TABLE "OrderFulfillment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "status" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "trackingCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderFulfillment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FulfillmentEvent" (
    "id" TEXT NOT NULL,
    "fulfillmentId" TEXT NOT NULL,
    "status" "FulfillmentStatus" NOT NULL,
    "note" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FulfillmentEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderFulfillment_orderId_storeId_key"
    ON "OrderFulfillment"("orderId", "storeId");
CREATE INDEX "OrderFulfillment_storeId_status_updatedAt_idx"
    ON "OrderFulfillment"("storeId", "status", "updatedAt");
CREATE INDEX "OrderFulfillment_orderId_createdAt_idx"
    ON "OrderFulfillment"("orderId", "createdAt");
CREATE INDEX "FulfillmentEvent_fulfillmentId_createdAt_idx"
    ON "FulfillmentEvent"("fulfillmentId", "createdAt");
CREATE INDEX "FulfillmentEvent_actorId_createdAt_idx"
    ON "FulfillmentEvent"("actorId", "createdAt");

ALTER TABLE "OrderFulfillment"
    ADD CONSTRAINT "OrderFulfillment_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderFulfillment"
    ADD CONSTRAINT "OrderFulfillment_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FulfillmentEvent"
    ADD CONSTRAINT "FulfillmentEvent_fulfillmentId_fkey"
    FOREIGN KEY ("fulfillmentId") REFERENCES "OrderFulfillment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FulfillmentEvent"
    ADD CONSTRAINT "FulfillmentEvent_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "OrderFulfillment" ("id", "orderId", "storeId", "status", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || paid."orderId" || paid."storeId"),
       paid."orderId", paid."storeId", 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT o."id" AS "orderId", p."storeId"
    FROM "Order" o
    JOIN "OrderItem" i ON i."orderId" = o."id"
    JOIN "Product" p ON p."id" = i."productId"
    WHERE o."status" = 'PAID'
) paid;

INSERT INTO "FulfillmentEvent" ("id", "fulfillmentId", "status", "note", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || f."id"), f."id", 'PENDING', 'Commande payée, en attente de préparation', CURRENT_TIMESTAMP
FROM "OrderFulfillment" f;
