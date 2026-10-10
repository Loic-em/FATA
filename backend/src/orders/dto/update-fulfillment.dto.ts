import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateFulfillmentDto {
  @IsIn(["PREPARING", "READY_FOR_PICKUP", "SHIPPED"])
  status!: "PREPARING" | "READY_FOR_PICKUP" | "SHIPPED";

  @IsOptional()
  @IsString()
  @MaxLength(100)
  trackingCode?: string;
}
