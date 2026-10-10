import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  defaultAddress?: string;
}
