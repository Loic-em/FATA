CREATE TYPE "AnalyticsEventType" AS ENUM ('VISIT', 'STORE_VIEW', 'PRODUCT_VIEW', 'CART_ADD', 'FAVORITE_ADD');

CREATE TABLE "AnalyticsDailyAggregate" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "eventType" "AnalyticsEventType" NOT NULL,
    "productId" TEXT NOT NULL DEFAULT '',
    "storeId" TEXT NOT NULL DEFAULT '',
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AnalyticsDailyAggregate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalyticsDailyAggregate_day_eventType_productId_storeId_key"
    ON "AnalyticsDailyAggregate"("day", "eventType", "productId", "storeId");
CREATE INDEX "AnalyticsDailyAggregate_eventType_day_idx"
    ON "AnalyticsDailyAggregate"("eventType", "day");
CREATE INDEX "AnalyticsDailyAggregate_storeId_day_eventType_idx"
    ON "AnalyticsDailyAggregate"("storeId", "day", "eventType");
CREATE INDEX "AnalyticsDailyAggregate_productId_day_eventType_idx"
    ON "AnalyticsDailyAggregate"("productId", "day", "eventType");
