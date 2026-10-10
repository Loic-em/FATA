import { IsIn } from "class-validator";

export class SimulatePaymentDto {
  @IsIn(["SUCCESS", "FAILED", "PENDING"])
  outcome!: "SUCCESS" | "FAILED" | "PENDING";
}
