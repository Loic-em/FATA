ALTER TABLE "Notification" ADD COLUMN "orderId" TEXT;

CREATE INDEX "Notification_orderId_type_idx" ON "Notification"("orderId", "type");

ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
