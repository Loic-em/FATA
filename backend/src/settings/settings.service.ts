import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdatePlatformSettingsDto } from "./dto/update-platform-settings.dto";

const DEFAULT_DELIVERY_FEES = {
  deliveryFeeAbidjan: 2000,
  deliveryFeeGrandBassam: 1000,
  deliveryFeeOther: 3500,
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDeliveryFees() {
    await this.prisma.$executeRaw`
      INSERT INTO "PlatformSettings" ("id") VALUES ('main')
      ON CONFLICT ("id") DO NOTHING
    `;
    const [settings] = await this.prisma.$queryRaw<typeof DEFAULT_DELIVERY_FEES[]>`
      SELECT "deliveryFeeAbidjan", "deliveryFeeGrandBassam", "deliveryFeeOther"
      FROM "PlatformSettings" WHERE "id" = 'main'
    `;
    return { ...DEFAULT_DELIVERY_FEES, ...settings, pickupFee: 0, currency: "XOF" as const };
  }

  async getAdminSettings() {
    return this.getDeliveryFees();
  }

  async updateAdminSettings(dto: UpdatePlatformSettingsDto) {
    await this.prisma.$executeRaw`
      INSERT INTO "PlatformSettings" ("id", "deliveryFeeAbidjan", "deliveryFeeGrandBassam", "deliveryFeeOther")
      VALUES ('main', ${dto.deliveryFeeAbidjan}, ${dto.deliveryFeeGrandBassam}, ${dto.deliveryFeeOther})
      ON CONFLICT ("id") DO UPDATE SET
        "deliveryFeeAbidjan" = EXCLUDED."deliveryFeeAbidjan",
        "deliveryFeeGrandBassam" = EXCLUDED."deliveryFeeGrandBassam",
        "deliveryFeeOther" = EXCLUDED."deliveryFeeOther",
        "updatedAt" = CURRENT_TIMESTAMP
    `;
    return this.getDeliveryFees();
  }
}
