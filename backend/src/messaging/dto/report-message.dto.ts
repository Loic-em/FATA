import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

export class ReportMessageDto {
  @IsIn(["HARASSMENT", "SCAM", "OFF_PLATFORM", "OTHER"])
  reason!: "HARASSMENT" | "SCAM" | "OFF_PLATFORM" | "OTHER";

  @IsString()
  @MinLength(8)
  @MaxLength(500)
  details!: string;
}
