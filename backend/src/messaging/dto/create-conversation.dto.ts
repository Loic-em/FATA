import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateConversationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  productId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  orderId?: string;
}
