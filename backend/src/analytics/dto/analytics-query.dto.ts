import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class AnalyticsQueryDto {
  @IsOptional()
  @IsIn(["today", "7d", "30d", "3m", "1y"])
  period?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  sellerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;
}
