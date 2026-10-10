import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from "class-validator";

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsIn(["CLIENT", "SELLER"])
  role?: "CLIENT" | "SELLER";

  @ValidateIf(dto => dto.role === "SELLER")
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  storeName?: string;
}
