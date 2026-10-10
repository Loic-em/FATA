import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";

class CreateOrderItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;
}

export class CreateOrderDto {
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  @Matches(/^[+0-9()\s.-]+$/)
  phone!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  city!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(300)
  address!: string;

  @IsIn(["DELIVERY", "PICKUP"])
  deliveryType!: "DELIVERY" | "PICKUP";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
