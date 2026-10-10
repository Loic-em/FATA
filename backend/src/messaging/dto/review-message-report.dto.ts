import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class ReviewMessageReportDto {
  @IsIn(["REVIEWED", "DISMISSED"])
  status!: "REVIEWED" | "DISMISSED";

  @IsOptional()
  @IsIn(["NONE", "CLOSE_CONVERSATION", "SUSPEND_MESSAGE_SENDER"])
  action?: "NONE" | "CLOSE_CONVERSATION" | "SUSPEND_MESSAGE_SENDER";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolution?: string;
}
