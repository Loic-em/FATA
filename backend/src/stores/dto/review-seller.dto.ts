import { IsIn } from "class-validator";

export class ReviewSellerDto {
  @IsIn(["APPROVED", "REJECTED"])
  status!: "APPROVED" | "REJECTED";
}
