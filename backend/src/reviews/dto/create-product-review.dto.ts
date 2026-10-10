import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class CreateProductReviewDto {
  @IsString()
  @MaxLength(128)
  orderItemId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  body?: string | null;
}
