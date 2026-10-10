import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateStoreDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  description!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  image?: string | null;
}
