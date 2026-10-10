ALTER TABLE "PaymentAttempt"
ADD COLUMN "providerReference" TEXT;

CREATE UNIQUE INDEX "PaymentAttempt_providerReference_key"
ON "PaymentAttempt"("providerReference");
