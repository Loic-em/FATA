ALTER TABLE "User"
ADD COLUMN "phone" TEXT,
ADD COLUMN "defaultCity" TEXT,
ADD COLUMN "defaultAddress" TEXT;

CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL,
    "deliveryFeeAbidjan" INTEGER NOT NULL DEFAULT 2000,
    "deliveryFeeGrandBassam" INTEGER NOT NULL DEFAULT 1000,
    "deliveryFeeOther" INTEGER NOT NULL DEFAULT 3500,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlatformSettings" ("id") VALUES ('main');
