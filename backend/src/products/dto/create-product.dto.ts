import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description!: string;

  @IsInt()
  @Min(1)
  @Max(100_000_000)
  price!: number;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stock!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  categoryId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  image?: string;
}
