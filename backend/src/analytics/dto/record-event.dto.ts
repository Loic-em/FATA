import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class RecordEventDto {
  @IsIn(["VISIT", "STORE_VIEW", "PRODUCT_VIEW", "CART_ADD", "FAVORITE_ADD"])
  eventType!: "VISIT" | "STORE_VIEW" | "PRODUCT_VIEW" | "CART_ADD" | "FAVORITE_ADD";

  @IsOptional()
  @IsString()
  @MaxLength(128)
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  storeId?: string;
}
